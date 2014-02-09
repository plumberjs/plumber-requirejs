plumber-requirejs [![Build Status](https://travis-ci.org/plumberjs/plumber-requirejs.png?branch=master)](https://travis-ci.org/plumberjs/plumber-requirejs)
=================

[RequireJS](http://requirejs.org/) compilation operation for [Plumber](https://github.com/plumberjs/plumber) pipelines.

## Example

    var requirejs = require('plumber-requirejs');

    module.exports = function(pipelines) {

        pipelines['compile'] = [
            glob('app.js'),
            requirejs({
              paths: {
                // Help resolve paths
                'lodash-modern': '../bower_components/lodash-amd/modern',

                // Not compiled in
                moment: 'empty:'
              }
            }),
            // ... more pipeline operations
        ];

    };


## API

### `requirejs(requireJsOptions)`

Compile each input JavaScript input resource using [RequireJS](http://requirejs.org/) (or `r.js`).  The resulting JavaScript resource will include all the AMD dependencies of the original resource.

Optionally, custom options can be passed to RequireJS (see [the example build file](https://github.com/jrburke/r.js/blob/master/build/example.build.js) for a full list).

Note that you should **not** specify input/output configuration options, such as `name`, `out` or `baseUrl`; these are automatically inferred and managed by the input resources.

Source maps for all input resources will be updated or generated accordingly.
