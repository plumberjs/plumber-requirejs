var chai = require('chai');
chai.should();

var sinon = require("sinon");
var sinonChai = require("sinon-chai");
chai.use(sinonChai);

var SourceMapConsumer = require('source-map').SourceMapConsumer;
var fs = require('fs');

var runOperation = require('plumber-util-test').runOperation;

var Resource = require('plumber').Resource;
var Supervisor = require('plumber/lib/util/supervisor');
var SourceMap = require('mercator').SourceMap;

var requirejs = require('..');

function createResource(params) {
    return new Resource(params);
}


describe('requirejs', function(){
    // var supervisor;

    // beforeEach(function() {
    //     supervisor = new Supervisor();
    //     supervisor.dependOn = sinon.spy();
    // });


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
        (function() {
            runOperation(requirejs(), [createResource({path: 'test/fixtures'})]).resources.toArray();
        }).should.throw('RequireJS does not support optimising directories yet');
    });

    describe('when passed a single AMD module', function() {
        var transformedResources;

        beforeEach(function() {
            var resource = createResource({path: 'test/fixtures/app.js', type: 'javascript'});

            transformedResources = runOperation(requirejs(), [resource]).resources;
        });

        it('should return a resource with the same path and filename', function(done){
            transformedResources.toArray(function(resources) {
                resources.length.should.equal(1);
                resources[0].path().absolute().should.equal('test/fixtures/app.js');
                resources[0].filename().should.equal('app.js');
                done();
            });
        });

        it('should return the same data, with explicit name and dependencies', function(done){
            transformedResources.toArray(function(resources) {
                resources[0].data().should.equal("define('app',[],function() {\n  return 42;\n});\n\n");
                done();
            });
        });

        it('should return it with an identity sourcemap', function(done){
            transformedResources.toArray(function(resources) {
                var map = new SourceMapConsumer(resources[0].sourceMap());
                map.sources.should.deep.equal(['test/fixtures/app.js']);

                map.sourcesContent.should.deep.equal(["define('app',[],function() {\n  return 42;\n});\n\n"]);

                // identity mapping
                for (var i = 1; i <= 5; i++) {
                    map.originalPositionFor({line: i, column: 0}).should.deep.equal({
                        source: 'test/fixtures/app.js',
                        line: i,
                        column: 0,
                        name: null
                    });
                }

                done();
            });
        });
    });

    describe('when passed an AMD module with a dependency', function() {
        var transformedResources;

        beforeEach(function() {
            var resource = createResource({path: 'test/fixtures/multi.js', type: 'javascript'});

            transformedResources = runOperation(requirejs(), [resource]).resources;
        });

        it('should return a resource with the same path and filename', function(done){
            transformedResources.toArray(function(resources) {
                resources.length.should.equal(1);
                resources[0].path().absolute().should.equal('test/fixtures/multi.js');
                resources[0].filename().should.equal('multi.js');
                done();
            });
        });

        it('should return a resource containing the dependency', function(done){
            transformedResources.toArray(function(resources) {
                resources[0].data().should.equal("define('other',[],function() {\n  return 100;\n});\n\ndefine('multi',['other'], function(other) {\n  return other + 1;\n});\n\n");
                done();
            });
        });

        it('should return it with a sourcemap', function(done){
            transformedResources.toArray(function(resources) {
                var map = new SourceMapConsumer(resources[0].sourceMap());
                map.sources.should.deep.equal(['test/fixtures/other.js', 'test/fixtures/multi.js']);
                map.sourcesContent.should.deep.equal([
                    "define('other',[],function() {\n  return 100;\n});\n\n",
                    "define('multi',['other'], function(other) {\n  return other + 1;\n});\n\n"
                ]);

              /*
             1 define('other',[],function() {
             2   return 100;
             3 });
             4
             5 define('multi',['other'], function(other) {
             6   return other + 1;
             7 });
               */

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

                done();
            });
        });

        // FIXME: must re-introduce supervisor in plumber 0.3?
        it.skip('should notify the supervisor of the dependency', function(){
            transformedResources.toArray(function(resources) {
                supervisor.dependOn.should.have.callCount(1);
                supervisor.dependOn.should.have.been.calledWith(['test/fixtures/other.js']);
            });
        });
    });

    describe('when passed a non-AMD file', function() {
        var transformedResources;

        beforeEach(function() {
            var nonAmdResource = createResource({path: 'test/fixtures/not-amd.js', type: 'javascript'});
            transformedResources = runOperation(requirejs(), [nonAmdResource]).resources;
        });

        it('should return a resource with the same path and filename', function(done){
            transformedResources.toArray(function(resources) {
                resources.length.should.equal(1);
                resources[0].path().absolute().should.equal('test/fixtures/not-amd.js');
                resources[0].filename().should.equal('not-amd.js');
                done();
            });
        });

        it('should return the same data as was input', function(done){
            transformedResources.toArray(function(resources) {
                resources[0].data().should.equal("var thisFileIsNotAnAMDModule = true;\n\nfunction meh() {}\n;\ndefine(\"not-amd\", function(){});\n\n");
                done();
            });
        });

        it('should return it with an identity sourcemap', function(done){
            transformedResources.toArray(function(resources) {
                var map = new SourceMapConsumer(resources[0].sourceMap());
                map.sources.should.deep.equal(['test/fixtures/not-amd.js']);
                map.sourcesContent.should.deep.equal(["var thisFileIsNotAnAMDModule = true;\n\nfunction meh() {}\n;\ndefine(\"not-amd\", function(){});\n\n"]);

                // identity mapping
                for (var i = 1; i <= 5; i++) {
                    map.originalPositionFor({line: i, column: 0}).should.deep.equal({
                        source: 'test/fixtures/not-amd.js',
                        line: i,
                        column: 0,
                        name: null
                    });
                }

                done();
            });
        });
    });

    describe('when passed two AMD files', function() {
        var transformedResources;

        beforeEach(function() {
            transformedResources = runOperation(requirejs(), [
                createResource({path: 'test/fixtures/app.js', type: 'javascript'}),
                createResource({path: 'test/fixtures/multi.js', type: 'javascript'})
            ]).resources;
        });

        it('should return two resources', function(done){
            transformedResources.toArray(function(resources) {
                resources.length.should.equal(2);
            });
            done();
        });
    });


    describe('when passed a file with a source map', function() {
        var transformedResources;
        var mainData = fs.readFileSync('test/fixtures/concatenated.js').toString();
        var mainMapData = SourceMap.fromMapData(fs.readFileSync('test/fixtures/concatenated.js.map').toString());

        beforeEach(function() {
            transformedResources = runOperation(requirejs(), [
                createResource({path: 'test/fixtures/concatenated.js', type: 'javascript',
                                data: mainData, sourceMap: mainMapData})
            ]).resources;
        });


        it.skip('should return a resource with a source map with correct properties from the input source map', function(done){
            transformedResources.toArray(function(resources) {
                var sourceMap = resources[0].sourceMap();

                sourceMap.file.should.equal('concatenated.js');
                sourceMap.sources.should.deep.equal(mainMapData.sources);
                sourceMap.sourcesContent.should.deep.equal(mainMapData.sourcesContent);
                done();
            });
        });

        it('should remap mappings based on the input source map', function(done) {
            transformedResources.toArray(function(resources) {
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

                done();
            });
        });

        // FIXME: must re-introduce supervisor in plumber 0.3?
        it.skip('should register no path in the supervisor', function(){
            transformedResources.toArray(function() {
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
