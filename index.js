var mapEachResourceSerially = require('plumber').mapEachResourceSerially;
var SourceMap = require('mercator').SourceMap;

var q = require('q');
var requirejs = require('requirejs');
var extend = require('extend');
var path = require('path');

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

// Delete any plugin prefix from the path,
// e.g. 'text!foo/bar.html' => 'foo/bar.html'
function stripPluginsPrefix(path) {
    return path.replace(/^.*!/, '');
}

function stripErroneousLeadingNewline(source) {
    return source.replace(/^\n/, '');
}

function resolvePathsRelativeTo(baseDir) {
    return function(relPath) {
        return path.resolve(baseDir, relPath);
    };
}


module.exports = function(baseOptions) {
    baseOptions = baseOptions || {};

    return mapEachResourceSerially(function(resource, supervisor) {
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

            return optimize(options).spread(function(data, sourceMapData) {
                var sourceMap = SourceMap.fromMapData(sourceMapData).
                    mapSourcePaths(stripPluginsPrefix).
                    mapSourcePaths(resolvePathsRelativeTo(basePath)).
                    rebaseSourcePaths(rootDir);

                // Record all other sources found in the source map in
                // the supervisor
                var resourcePath = resource.path() && resource.path().absolute();
                var dependencies = sourceMap.sources.filter(function(path) {
                    return path !== resourcePath;
                });
                if (dependencies.length > 0) {
                    supervisor.dependOn(dependencies);
                }

                // Due to a bug in RequireJS, we have to remove the erroneous
                // new line at the beginning of the file in order for the
                // source map to match correctly.
                // As per: https://github.com/jrburke/requirejs/issues/1011
                sourceMap.sourcesContent = sourceMap.sourcesContent.map(stripErroneousLeadingNewline);
                data = stripErroneousLeadingNewline(data);

                // FIXME: combine with input source map? - tests!
                // if (resource.sourceMap()) {
                //     sourceMap = resource.sourceMap().apply(sourceMap);
                // }

                return resource.withData(data, sourceMap);
            });
        }
    });
};
