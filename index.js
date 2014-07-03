var operation = require('plumber').operation;
var Rx = require('plumber').Rx;
var SourceMap = require('mercator').SourceMap;

var requirejs = require('requirejs');
var extend = require('extend');
var path = require('path');

// wrap requirejs.optimize as a promise
function optimize(options) {
    return Rx.Observable.create(function(observer) {
        // FIXME: error reject?
        requirejs.optimize(extend(options, {
            // never minimise source in here; it's the job of
            // another operation
            optimize: 'none',
            // always generate a sourcemap
            generateSourceMaps: true,
            out: function(compiledData, sourceMapData) {
                observer.onNext({
                    data: compiledData,
                    sourceMapData: sourceMapData
                });
                observer.onCompleted();
            }
        }));
    });
}

// Delete any plugin prefix from the path,
// e.g. 'text!foo/bar.html' => 'foo/bar.html'
function stripPluginsPrefix(path) {
    return path.replace(/^.*!/, '');
}

function resolvePathsRelativeTo(baseDir) {
    return function(relPath) {
        return path.resolve(baseDir, relPath);
    };
}

// Unwanted requirejs options (don't make sense with the nature of
// Plumber and this operation)
var illegalOptions = ['baseUrl' , 'name', 'out'];

module.exports = function(baseOptions) {
    baseOptions = baseOptions || {};

    // Abort if any illegal option provided
    illegalOptions.forEach(function(key) {
        if (key in baseOptions) {
            throw new Error("'" + key + "' option should not be used with plumber-requirejs, see documentation");
        }
    });


    // FIXME: does it need to run serially??
    // FIXME: supervisor
    return operation.parallelFlatMap(function(resource) {
        // TODO: accept directory as input resource
        if (resource.path().isDirectory()) {
            // TODO: optimize whole directory
            throw new Error('RequireJS does not support optimising directories yet');
        } else {
            var filename = resource.path().filename();
            var pathNoExt = filename.replace(/\.js$/, '');
            var basePath = resource.path().dirname();
            var rootDir = process.cwd();

            // FIXME: re-reads data from disk :-(
            var options = extend(baseOptions, {
                // FIXME: do we always want to use baseUrl?
                //        or as explicit argument?
                baseUrl: basePath,
                name: pathNoExt
            });

            return optimize(options).map(function(out) {
                var data = out.data;
                var sourceMap = SourceMap.fromMapData(out.sourceMapData).
                    mapSourcePaths(stripPluginsPrefix).
                    mapSourcePaths(resolvePathsRelativeTo(basePath)).
                    rebaseSourcePaths(rootDir);

                // Record all other sources found in the source map in
                // the supervisor
                var resourcePath = resource.path() && resource.path().absolute();
                var dependencies = sourceMap.sources.filter(function(path) {
                    return path !== resourcePath;
                });

                // FIXME: must re-introduce supervisor in plumber 0.3?
                // if (dependencies.length > 0) {
                //     supervisor.dependOn(dependencies);
                // }

                // If the source had a sourcemap, rebase the LESS
                // sourcemap based on that original map
                var originalMapData = resource.sourceMap();
                if (originalMapData) {
                    sourceMap = originalMapData.apply(sourceMap);
                }

                return resource.withData(data, sourceMap);
            });
        }
    });
};
