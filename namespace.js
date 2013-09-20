(function(mod) {
  /*jshint node:true, strict:false */
  /*global define:false, tern:false */
  if (typeof exports === "object" && typeof module === "object") // CommonJS
    return mod(require("../lib/infer"), require("../lib/tern"));
  if (typeof define === "function" && define.amd) // AMD
    return define(["../lib/infer", "../lib/tern"], mod);
  mod(tern, tern);
})(function(infer, tern) {
  "use strict";

  var PROVIDE_OBJ_WEIGHT = 50;

  function getNamespaceInstance(_self, nsName) {
    var context        = infer.cx();
    var namespaceClass = context.definitions.namespace.namespaceClass;
    var type           = _self.getType();
    if (type && type.proto === namespaceClass && type.__nsInfo) {
      return _self;
    }

    var nsDisplayName = nsName || "__ANON__";

    var instanceType = new infer.Obj(namespaceClass, "Namespace@" + nsDisplayName);
    instanceType.__nsInfo = {
      displayName : nsDisplayName,
      name        : nsName,
      uses        : []
    };
    return instanceType;
  }

  function getFilePathsByNsName(nsName, data) {
    var opts = data.options;
    var basePaths = opts.basePaths || [];
    if (opts.basePath) {
      basePaths.unshift(opts.basePath);
    }
    if (basePaths.length === 0) {
      basePaths.push("./");
    }
    var nsPath = nsName.replace(/\./g, "/") + ".js";
    var paths = [];
    basePaths.forEach(function(base) {
      var actualBasePath;
      var actualNsPath;
      if (typeof base === "string") {
        actualBasePath = base;
        actualNsPath = nsPath;
      } else if (base.path && base.prefix) {
        actualBasePath = base.path;
        var prefix = base.prefix.replace(/\.?$/, '.');
        if (nsName.indexOf(prefix) !== 0) return;
        actualNsPath = nsPath.substr(prefix.length);
      } else if (base.path && base.replace){
        actualBasePath = base.path;
        var regexp = new RegExp(base.replace[0], base.replace[2]);
        actualNsPath = nsPath.replace.apply(regexp, base.replace[1]);
        if (actualNsPath === nsPath) return; // no match
      } else {
        throw new Error("bad basePath(s) configuration");
      }
      paths.push(actualBasePath.replace(/\/?$/, "/") + actualNsPath);
    });
    return paths;
  }

  function defProvide(nsName, data) {
    if (!nsName) return infer.ANull;

    var provide = data.provides[nsName];
    if (provide) return provide;

    var newProvide = data.provides[nsName] = new infer.AVal();
    newProvide.addType(new infer.Obj(true, nsName), PROVIDE_OBJ_WEIGHT);
    return newProvide;
  }

  function getProvide(nsName, data, isDef) {
    if (!nsName) return infer.ANull;

    var provide = data.provides[nsName];
    if (provide) return provide;

    var newProvide = data.provides[nsName] = new infer.AVal();
    newProvide.addType(new infer.Obj(true, nsName), PROVIDE_OBJ_WEIGHT);

    var filePaths = getFilePathsByNsName(nsName, data);
    if (data.debug) console.log("namespace: loading file: " + filePaths);
    filePaths.forEach(function(filePath) {
      data.server.addFile(filePath);
    });

    return newProvide;
  }

  infer.registerFunction("Namespace", function(_self, args, argNodes) {
    var context = infer.cx();
    var server = context.parent;
    var data = server && server._Namespace;
    if ( !(data && argNodes) ) return infer.ANull;

    var nsName;
    if (argNodes.length && argNodes[0].type === "Literal" && typeof argNodes[0].value === "string") {
      nsName = argNodes[0].value;
    }

    if (data.debug) console.log("Namespace('" + nsName + "')");

    return getNamespaceInstance(_self, nsName);
  });

  infer.registerFunction("NamespaceUse", function(_self, args, argNodes) {
    var context = infer.cx();
    var server = context.parent;
    var data = server && server._Namespace;
    if ( !(
      data && argNodes &&
      (argNodes.length && argNodes[0].type === "Literal" && typeof argNodes[0].value === "string")
    ) ) {
      return _self;
    }

    var instance = getNamespaceInstance(_self);
    instance.getType(false).__nsInfo.uses.push(argNodes[0].value);

    return instance;
  });

  function buildNsObj(instanceType, data) {
    var context   = infer.cx();
    var nsInfo    = instanceType.__nsInfo;
    var nsObjType = new infer.Obj(context.definitions.namespace.nsObj, "nsObj@" + nsInfo.displayName);

    nsInfo.uses.forEach(function(useText) {
      var nsAndImports = useText.split(/\s+/, 2);
      var nsName       = nsAndImports[0];
      var importText   = nsAndImports[1];
      if ( !(nsName && importText) ) return;
      var imports      = importText.split(/\s*,\s*/);

      var provide = getProvide(nsName, data);
      if (imports.indexOf("*") !== -1 ) {
        provide.forAllProps(function(prop, val, local) {
          if (local && prop !== "prototype" && prop !== "<i>") {
            nsObjType.propagate(new infer.PropHasSubset(prop, val));
          }
        });
      } else {
        imports.forEach(function(importName) {
          nsObjType.propagate(new infer.PropHasSubset(importName, provide.getProp(importName)));
        });
      }
    });
    return nsObjType;
  }

  infer.registerFunction("NamespaceDefine", function(_self, args, argNodes) {
    var context = infer.cx();
    var server = context.parent;
    var data = server && server._Namespace;
    if ( !(data && args.length) ) return infer.ANull;

    var fn = args[0];
    if (!fn.getFunctionType()) return infer.ANull;

    var instance      = getNamespaceInstance(_self);
    var instanceType  = instance.getType(false);
    var nsInfo        = instanceType.__nsInfo;
    var nsObj         = buildNsObj(instanceType, data);
    var provide       = defProvide(nsInfo.name, data);
    var provideMethod = nsObj.defProp("provide");
    provideMethod.addType(new infer.Fn("provide", instance, [provide], ["obj"], infer.ANull));
    fn.propagate(new infer.IsCallee(infer.ANull, [nsObj], null, infer.ANull));

    if (data.debug) console.log("Namespace('" + nsInfo.name + "').define()");

    return infer.ANull;
  });

  tern.registerPlugin("namespace", function(server, options) {
    server._Namespace = {
      provides: Object.create(null),
      options: options || {},
      server: server,
      debug : options.debug
    };

    server.on("reset", function() {
      this._Namespace.provides = Object.create(null);
    });
    return {defs : defs};
  });

  var defs = {
    "!name"   : "namespace",
    "!define" : {
      nsObj: {
        "!doc"  : "Private namespace object. Contains imported properties and namespaces.",
        provide : {
          "!doc" : "Publish specified object to other namespaces.",
          "!type" : "fn(+Object)"
        }
      },
      namespaceClass : {
        "!doc"  : "Create new namespace.",
        "!type" : "fn(namespace: string) -> !custom:Namespace",
        use : {
          "!doc"  : "Import expoted namespace. Accepts comma seperated list of property names after space.",
          "!type" : "fn(import: string) -> !custom:NamespaceUse"
        },
        define : {
          "!doc"  : "Define namespace with callback func (as needed). Make sure ns.provide() to be called.",
          "!type" : "fn(callback: fn(ns: nsObj)) -> !custom:NamespaceDefine",
 
        },
        apply : {
          "!doc"  : "Run callback func with imported namespaces.",
          "!type" : "fn(callback: fn(ns: nsObj)) -> !custom:NamespaceDefine",
 
        },
      },
    },
    Namespace : "namespaceClass"
  };
});
