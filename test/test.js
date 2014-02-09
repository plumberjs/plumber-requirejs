var chai = require('chai');
chai.should();

var chaiAsPromised = require("chai-as-promised");
chai.use(chaiAsPromised);

var sinon = require("sinon");
var sinonChai = require("sinon-chai");
chai.use(sinonChai);

require('mocha-as-promised')();

var SourceMapConsumer = require('source-map').SourceMapConsumer;
var fs = require('fs');


var Resource = require('plumber').Resource;
var Supervisor = require('plumber/lib/util/supervisor');
var SourceMap = require('mercator').SourceMap;

var requirejs = require('..');

function createResource(params) {
    return new Resource(params);
}


describe('requirejs', function(){
    var supervisor;

    beforeEach(function() {
        supervisor = new Supervisor();
        supervisor.dependOn = sinon.spy();
    });


    it('should be a function', function(){
        requirejs.should.be.a('function');
    });

    it('should return a function', function(){
        requirejs().should.be.a('function');
    });

    it('should throw an error if passed an illegal option', function(){
        (function() {
            requirejs({name: 'foo'});
        }).should.throw("'name' option should not be used with plumber-requirejs, see documentation");

        (function() {
            requirejs({out: 'foo'});
        }).should.throw("'out' option should not be used with plumber-requirejs, see documentation");

        (function() {
            requirejs({baseUrl: 'foo'});
        }).should.throw("'baseUrl' option should not be used with plumber-requirejs, see documentation");
    });

    it('should throw an exception if passed a directory', function(){
        var output = requirejs()([createResource({path: 'test/fixtures'})], supervisor);
        return output.should.eventually.be.rejectedWith('RequireJS does not support optimising directories yet');
    });

    describe('when passed a single AMD module', function() {
        var transformedResources;

        beforeEach(function() {
            var resource = createResource({path: 'test/fixtures/app.js', type: 'javascript'});

            transformedResources = requirejs()([resource], supervisor);
        });

        it('should return a resource with the same path and filename', function(){
            return transformedResources.then(function(resources) {
                resources.length.should.equal(1);
                resources[0].path().absolute().should.equal('test/fixtures/app.js');
                resources[0].filename().should.equal('app.js');
            });
        });

        it('should return the same data, with explicit name and dependencies', function(){
            return transformedResources.then(function(resources) {
                resources[0].data().should.equal("define('app',[],function() {\n  return 42;\n});\n");
            });
        });

        it('should return it with an identity sourcemap', function(){
            return transformedResources.then(function(resources) {
                var map = new SourceMapConsumer(resources[0].sourceMap());
                map.sources.should.deep.equal(['test/fixtures/app.js']);
                map.sourcesContent.should.deep.equal(["define('app',[],function() {\n  return 42;\n});\n"]);

                // identity mapping
                for (var i = 1; i <= 5; i++) {
                    map.originalPositionFor({line: i, column: 0}).should.deep.equal({
                        source: 'test/fixtures/app.js',
                        line: i,
                        column: 0,
                        name: null
                    });
                }
            });
        });
    });

    describe('when passed an AMD module with a dependency', function() {
        var transformedResources;

        beforeEach(function() {
            var resource = createResource({path: 'test/fixtures/multi.js', type: 'javascript'});

            transformedResources = requirejs()([resource], supervisor);
        });

        it('should return a resource with the same path and filename', function(){
            return transformedResources.then(function(resources) {
                resources.length.should.equal(1);
                resources[0].path().absolute().should.equal('test/fixtures/multi.js');
                resources[0].filename().should.equal('multi.js');
            });
        });

        it('should return a resource containing the dependency', function(){
            return transformedResources.then(function(resources) {
                resources[0].data().should.equal("define('other',[],function() {\n  return 100;\n});\n\ndefine('multi',['other'], function(other) {\n  return other + 1;\n});\n");
            });
        });

        it('should return it with a sourcemap', function(){
            return transformedResources.then(function(resources) {
                var map = new SourceMapConsumer(resources[0].sourceMap());
                map.sources.should.deep.equal(['test/fixtures/other.js', 'test/fixtures/multi.js']);
                map.sourcesContent.should.deep.equal([
                    "define('other',[],function() {\n  return 100;\n});\n",
                    "define('multi',['other'], function(other) {\n  return other + 1;\n});\n"
                ]);

                // first file has identity mapping
                var i, offset = 5;
                for (i = 1; i < offset; i++) {
                    map.originalPositionFor({line: i, column: 0}).should.deep.equal({
                        source: 'test/fixtures/other.js',
                        line: i,
                        column: 0,
                        name: null
                    });
                }

                // second file is offset
                for (i = 0; i < 3; i++) {
                    map.originalPositionFor({line: i + offset, column: 0}).should.deep.equal({
                        source: 'test/fixtures/multi.js',
                        line: i + 1, // numbering from 1
                        column: 0,
                        name: null
                    });
                }
            });
        });

        it('should notify the supervisor of the dependency', function(){
            return transformedResources.then(function(resources) {
                supervisor.dependOn.should.have.callCount(1);
                supervisor.dependOn.should.have.been.calledWith(['test/fixtures/other.js']);
            });
        });
    });

    describe('when passed a non-AMD file', function() {
        var transformedResources;

        beforeEach(function() {
            var nonAmdResource = createResource({path: 'test/fixtures/not-amd.js', type: 'javascript'});
            transformedResources = requirejs()([nonAmdResource], supervisor);
        });

        it('should return a resource with the same path and filename', function(){
            return transformedResources.then(function(resources) {
                resources.length.should.equal(1);
                resources[0].path().absolute().should.equal('test/fixtures/not-amd.js');
                resources[0].filename().should.equal('not-amd.js');
            });
        });

        it('should return the same data as was input', function(){
            return transformedResources.then(function(resources) {
                resources[0].data().should.equal("var thisFileIsNotAnAMDModule = true;\n\nfunction meh() {}\n;\ndefine(\"not-amd\", function(){});\n");
            });
        });

        it('should return it with an identity sourcemap', function(){
            return transformedResources.then(function(resources) {
                var map = new SourceMapConsumer(resources[0].sourceMap());
                map.sources.should.deep.equal(['test/fixtures/not-amd.js']);
                map.sourcesContent.should.deep.equal(["var thisFileIsNotAnAMDModule = true;\n\nfunction meh() {}\n;\ndefine(\"not-amd\", function(){});\n"]);

                // identity mapping
                for (var i = 1; i <= 5; i++) {
                    map.originalPositionFor({line: i, column: 0}).should.deep.equal({
                        source: 'test/fixtures/not-amd.js',
                        line: i,
                        column: 0,
                        name: null
                    });
                }
            });
        });
    });

    describe('when passed two AMD files', function() {
        var transformedResources;

        beforeEach(function() {
            transformedResources = requirejs()([
                createResource({path: 'test/fixtures/app.js', type: 'javascript'}),
                createResource({path: 'test/fixtures/multi.js', type: 'javascript'})
            ], supervisor);
        });

        it('should return two resources', function(){
            return transformedResources.then(function(resources) {
                resources.length.should.equal(2);
            });
        });
    });


    describe('when passed a file with a source map', function() {
        var transformedResources;
        var mainData = fs.readFileSync('test/fixtures/concatenated.js').toString();
        var mainMapData = SourceMap.fromMapData(fs.readFileSync('test/fixtures/concatenated.js.map').toString());

        beforeEach(function() {
            transformedResources = requirejs()([
                createResource({path: 'test/fixtures/concatenated.js', type: 'javascript',
                                data: mainData, sourceMap: mainMapData})
            ], supervisor);
        });


        it('should return a resource with a source map with correct properties from the input source map', function(){
            return transformedResources.then(function(resources) {
                var sourceMap = resources[0].sourceMap();

                sourceMap.file.should.equal('concatenated.js');
                sourceMap.sources.should.deep.equal(mainMapData.sources);
                sourceMap.sourcesContent.should.deep.equal(mainMapData.sourcesContent);
            });
        });

        it('should remap mappings based on the input source map', function() {
            return transformedResources.then(function(resources) {
                var map = new SourceMapConsumer(resources[0].sourceMap());

                // FIXME: a better test would make requirejs do
                // something, rather than these non-AMD files that are
                // probably just passed through

                /*
               1 var x = 3;
               2 var y = x;
               3
               4 /\* a comment *\/
               5
               6 function inc(x) {
               7     return x + 1;
               8 }
               9
              10 var z = inc(x);
              11
              12
              13 /\* non-sensical library *\/
              14 define('concatenated',[], function() {
              15   var number = 1;
              16
              17   function addNumber(n) {
              18     return n + number;
              19   }
              20
              21   return addNumber;
              22 });
                 */
                map.originalPositionFor({line: 1, column: 0}).should.deep.equal({
                    source: 'test/fixtures/source.js',
                    line: 1,
                    column: 0,
                    name: null
                });
            });
        });

        it('should register no path in the supervisor', function(){
            return transformedResources.then(function() {
                supervisor.dependOn.should.not.have.been.called;
            });
        });

    });


    /* TODO: must manually load requirejs-text plugin
    describe('when passed an AMD file with a text! dependency', function() {
        var transformedResources;

        beforeEach(function() {
            transformedResources = requirejs()([
                createResource({path: 'test/fixtures/with-text.js', type: 'javascript'})
            ]);
        });

        it('should correctly reference the text dependency', function(){
            return transformedResources.then(function(resources) {
                resources.length.should.equal(2);
            });
        });
    });
    */

    // TODO: check if rjs error
});
