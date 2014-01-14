var mapEachResourceSerially = require('plumber').mapEachResourceSerially;

var q = require('q');
var requirejs = require('requirejs');
var extend = require('extend');

// wrap requirejs.optimize as a promise
function optimize(options) {
    return q.promise(function(resolve) {
        // FIXME: error reject?
        requirejs.optimize(extend(options, {
            // never minimise source in here; it's the job of
            // another operation
            optimize: 'none',
            // always generate a sourcemap
            generateSourceMaps: true,
            out: function(compiledData, sourceMapText) {
                resolve([compiledData, sourceMapText]);
            }
        }));
    });
}

module.exports = function(baseOptions) {
    baseOptions = baseOptions || {};

    return mapEachResourceSerially(function(resource) {
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

            return optimize(options).spread(function(data, sourceMap) {
                return resource.withData(data).withSourceMap(sourceMap);
            });
        }
    });
};
