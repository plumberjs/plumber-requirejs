var chai = require('chai');
chai.should();
var chaiAsPromised = require("chai-as-promised");

chai.use(chaiAsPromised);

require('mocha-as-promised')();

var SourceMapConsumer = require('source-map').SourceMapConsumer;


var Resource = require('plumber').Resource;

var requirejs = require('..');

function createResource(params) {
  return new Resource(params);
}


describe('requirejs', function(){
  it('should be a function', function(){
    requirejs.should.be.a('function');
  });

  it('should return a function', function(){
    requirejs().should.be.a('function');
  });

  it('should throw an exception if passed a directory', function(){
    var output = requirejs()([createResource({path: 'test/fixtures'})]);
    return output.should.eventually.be.rejectedWith('RequireJS does not support optimising directories yet');
  });

  describe('when passed a single AMD module', function() {
    var transformedResources;

    beforeEach(function() {
      var resource = createResource({path: 'test/fixtures/app.js', type: 'javascript'});

      transformedResources = requirejs()([resource]);
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

      transformedResources = requirejs()([resource]);
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
  });

  describe('when passed a non-AMD file', function() {
    var transformedResources;

    beforeEach(function() {
      var nonAmdResource = createResource({path: 'test/fixtures/not-amd.js', type: 'javascript'});
      transformedResources = requirejs()([nonAmdResource]);
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
      ]);
    });

    it('should return two resources', function(){
      return transformedResources.then(function(resources) {
        resources.length.should.equal(2);
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
