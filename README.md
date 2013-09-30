tern_namespace_js_plugin
=====================

Plugin for [tern](https://github.com/marijnh/tern) that enables it to understand [namespace.js](https://github.com/hirokidaichi/namespace-js) dependency injection.

## Installation

1. Install [tern](http://ternjs.net/).
    * vim: [tern_for_vim](https://github.com/marijnh/tern_for_vim)
    * emacs: [tern.el](http://ternjs.net/doc/manual.html#emacs) in tern main repo
    * sublime: [tern_for_sublime](https://github.com/marijnh/tern_for_sublime)

2. Copy the **namespace.js** file from this repository into your tern plugin directory. For Example:

  ```bash
    # vim
    cp /path/to/namespace.js ~/.vim/bundle/tern_for_vim/node_modules/tern/plugin

    # sublime
    cp /path/to/namespace.js ~/Library/Application Support/Sublime Text 3/Packages/tern_for_sublime/node_modules/tern/plugin

    # other
    cp /path/to/namespace.js /path/to/tern/plugin

  ```

3. Create your `.tern-project` file in the base of your project (if you haven't already) and add namespace to the plugins.
An example .tern-project file with this setup could be:

  ```js
    {
      "libs": [
        "browser",
        "jquery",
        "ecma5",
        "underscore"
      ],
      "plugins": {
        "namespace": {
          "basePath" : "static/js"
        }
      }
    }
  ```

## Plugin options

Plugin options could be specified after `"namespace" : {` in `plugins` section.
Currently these options supported:

* basePaths : `[(basePath), ...]` Specify multiple basePath. First has precedence.
* basePath :
    * `"path/to/jsdir"`

        Base directory for finding module files.

        Ex: `.use('net.ypresto.example.somemodule')` will load `path/to/jsdir/net/ypresto/example/somemodule.js`.

    * `{ "prefix", "net.ypresto.lib", "path" : "path/to/jslibdir" }`

        Similar to above, but cutoff prefix from namespace name.

        Ex: `.use('net.ypresto.lib.networking.jsonrpc')` will load `path/to/jslibdir/networking/jsonrpc.js`.

* debug : enable verbose logging. boolean.

## Create plugin / defs of specific namespace

This plugin supports custom plugin and defs tied with specific namespace.
To define:

1. Create (plugin or json) defs with its name is "namespace_def__your.namespace.name",
    i.e. `"!name": "namespace_def__your.namespace.name"`.
2. Add __provide__ in !define, which will be treated as the argument of provide(),
    i.e. `"!define": { "__provide__": { "someExportedMethods" : ... } }`.
    You can use !custom: retvals or effects as other tern plugins/defs.
3. Load plugin or defs as usual,
    i.e. add to plugins or libs (for json) of .tern-project.

\# This README was lent from [AngularJS plugin](https://github.com/angular-ui/AngularJS-tern-plugin) one. thx!
