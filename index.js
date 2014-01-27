var mapEachResourceSerially = require('plumber').mapEachResourceSerially;

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

// Delete any plugin prefix from the path, e.g. 'text!foo/bar.html' => 'foo/bar.html'
// TODO: extract this to a SourceMap helper object
function stripPluginsFromSourceMapPaths(sourceMapObj) {
    sourceMapObj.sources = sourceMapObj.sources.map(function(path) {
        return path.replace(/^.*!/, '');
    });
    return sourceMapObj;
}

// TODO: extract this to a SourceMap helper object
function makeSourceMapPathsRelativeToRoot(sourceMapObj, baseDir, rootDir) {
    sourceMapObj.sources = sourceMapObj.sources.map(function(relPath) {
        return path.relative(rootDir, path.resolve(baseDir, relPath));
    });
    return sourceMapObj;
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
                var sourceMap = JSON.parse(sourceMapData);
                // TODO: don't let helpers mutate original
                sourceMap = stripPluginsFromSourceMapPaths(sourceMap);
                sourceMap = makeSourceMapPathsRelativeToRoot(sourceMap, basePath, rootDir);
                sourceMap.sourcesContent = sourceMap.sourcesContent.map(function (sourceContent) {
                  return sourceContent.replace('\ndefine(', 'define(');
                });
                data = data.replace('\ndefine(', 'define(');
                return resource.
                    withData(data).
                    withSourceMap(JSON.stringify(sourceMap));
            });
        }
    });
};
