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
    requirejs.optimize(options, function(response) {
        defer.resolve(response);
    });
    // FIXME: error reject?
    return defer.promise;
}

module.exports = function(baseOptions) {
    baseOptions = baseOptions || {};

    return mapEachResource(function(resource) {
        // TODO: accept directory as input resource
        if (false && resource.isDirectory()) {
            // TODO: optimize whole directory
        } else {
            var filename = resource.path().filename();
            var pathNoExt = filename.replace(/\.js$/, '');
            var tmpFile = filename; // TODO: generate filename in tmp folder

            var options = extend(baseOptions, {
                // FIXME: do we always want to use baseUrl?
                //        or as explicit argument?
                baseUrl: resource.path().dirname(),
                name: pathNoExt,
                out: tmpFile
            });

            return optimize(options).then(function() {
                // FIXME: don't hardcode encoding?
                return readFile(tmpFile, 'utf-8');
            }).then(function(compiledData) {
                // Cleanup temporary file
                unlink(tmpFile);

                // and return generated data as a resource
                return resource.withData(compiledData);
            });
        }
    });
};
