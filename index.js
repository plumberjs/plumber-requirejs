var mapEachResource = require('plumber').mapEachResource;

var q = require('q');
var requirejs = require('requirejs');
var fs = require('fs');
var flatten = require('flatten');
var extend = require('extend');

var readFile = q.denodeify(fs.readFile);
var unlink = q.denodeify(fs.unlink);

// wrap requirejs.optimize as a promise
function optimize(options) {
    var defer = q.defer();
    requirejs.optimize(extend(options, {
      // never minimise source in here; it's the job of
      // another operation
      optimize: 'none',
      // always generate a sourcemap
      generateSourceMaps: true,
      out: function(compiledData, sourceMapText) {
        defer.resolve({data: compiledData, sourceMap: sourceMapText});
      }
    }));
    // FIXME: error reject?
    return defer.promise;
}

module.exports = function(baseOptions) {
    baseOptions = baseOptions || {};

    return mapEachResource(function(resource) {
        // TODO: accept directory as input resource
        if (resource.path().isDirectory()) {
            // TODO: optimize whole directory
            throw new Error('RequireJS does not support optimising directories yet');
        } else {
            var filename = resource.path().filename();
            var pathNoExt = filename.replace(/\.js$/, '');

            // FIXME: re-reads data from disk :-(
            var options = extend(baseOptions, {
                // FIXME: do we always want to use baseUrl?
                //        or as explicit argument?
                baseUrl: resource.path().dirname(),
                name: pathNoExt
            });

            return optimize(options).then(function(output) {
                return resource.
                    withData(output.data).
                    withSourceMap(output.sourceMap);
            });
        }
    });
};
