(function(root, factory) {
  if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else if (typeof exports === 'object') {
    module.exports = factory();
  } else {
    root.loadjs = factory();
  }
}(this, function() {
/**
 * Global dependencies.
 * @global {Object} document - DOM
 */

var devnull = function() {},
    bundleIdCache = {},
    bundleResultCache = {},
    bundleCallbackQueue = {};


/**
 * Subscribe to bundle load event.
 * @param {string[]} bundleIds - Bundle ids
 * @param {Function} callbackFn - The callback function
 */
function subscribe(bundleIds, callbackFn) {
  // listify
  bundleIds = bundleIds.push ? bundleIds : [bundleIds];
  
  var depsNotFound = [],
      i = bundleIds.length,
      numWaiting = i,
      fn, bundleId, r, q;

  // define callback function
  fn = function(bundleId, pathsNotFound) {
    if (pathsNotFound.length) depsNotFound.push(bundleId);

    numWaiting--;
    if (!numWaiting) callbackFn(depsNotFound);
  };
  
  // register callback
  while (i--) {
    bundleId = bundleIds[i];
    
    // execute callback if in result cache
    r = bundleResultCache[bundleId];
    if (r) {
      fn(bundleId, r);
      continue;
    }
    
    // add to callback queue
    q = bundleCallbackQueue[bundleId] = bundleCallbackQueue[bundleId] || [];
    q.push(fn);
  }
}


/**
 * Publish bundle load event.
 * @param {string} bundleId - Bundle id
 * @param {string[]} pathsNotFound - List of files not found
 */
function publish(bundleId, pathsNotFound) {
  // exit if id isn't defined
  if (!bundleId) return;
  
  var q = bundleCallbackQueue[bundleId];
  
  // cache result
  bundleResultCache[bundleId] = pathsNotFound;
  
  // exit if queue is empty
  if (!q) return;
  
  // empty callback queue
  while (q.length) {
    q[0](bundleId, pathsNotFound);
    q.splice(0, 1);
  }
}


/**
 * Load individual file.
 * @param {string} path - The file path
 * @param {Function} callbackFn - The callback function
 */
function loadFile(path, callbackFn, async) {
  var doc = document,
      isCss,
      e;

  if (/\.css$/.test(path)) {
    isCss = true;

    // css
    e = doc.createElement('link');
    e.rel = 'stylesheet';
    e.href = path;
  } else {
    // javascript
    e = doc.createElement('script');
    e.src = path;
    e.async = (async === undefined) ? true : async;
  }

  e.onload = e.onerror = e.onbeforeload = function(ev) {
    var result = ev.type[0];

    // Note: The following code isolates IE using `hideFocus` and treats empty
    // stylesheets as failures to get around lack of onerror support
    if (isCss && 'hideFocus' in e) {
      try {
        if (!e.sheet.cssText.length) result = 'e';
      } catch (x) {
        // sheets objects created from load errors don't allow access to
        // `cssText`
        result = 'e';
      }
    }

    // execute callback
    callbackFn(path, result, ev.defaultPrevented);
  };
  
  // add to document
  doc.head.appendChild(e);
}


/**
 * Load multiple files.
 * @param {string[]} paths - The file paths
 * @param {Function} callbackFn - The callback function
 */
function loadFiles(paths, callbackFn, async) {
  // listify paths
  paths = paths.push ? paths : [paths];
  
  var numWaiting = paths.length, x = numWaiting, pathsNotFound = [], fn, i;
  
  // define callback function
  fn = function(path, result, defaultPrevented) {
    // handle error
    if (result == 'e') pathsNotFound.push(path);

    // handle beforeload event. If defaultPrevented then that means the load
    // will be blocked (ex. Ghostery/ABP on Safari)
    if (result == 'b') {
      if (defaultPrevented) pathsNotFound.push(path);
      else return;
    }
    
    numWaiting--;
    if (!numWaiting) callbackFn(pathsNotFound);
  };
  
  // load scripts
  for (i=0; i < x; i++) loadFile(paths[i], fn, async);
}


/**
 * Initiate script load and register bundle.
 * @param {(string|string[])} paths - The file paths
 * @param {(string|Function)} [arg1] - The bundleId or success callback
 * @param {Function} [arg2] - The success or fail callback
 * @param {Function} [arg3] - The fail callback
 */
function loadjs(paths, arg1, arg2) {
  var bundleId, args;
  
  // bundleId (if string)
  if (arg1 && arg1.trim) bundleId = arg1;

  // args (default is {})
  args = (bundleId ? arg2 : arg1) || {};
  
  // throw error if bundle is already defined
  if (bundleId) {
    if (bundleId in bundleIdCache) {
      throw new Error("LoadJS");
    } else {
      bundleIdCache[bundleId] = true;
    }
  }
  
  // load scripts
  loadFiles(paths, function(pathsNotFound) {
    // success and fail callbacks
    if (pathsNotFound.length) (args.fail || devnull)(pathsNotFound);
    else (args.success || devnull)();

    // publish bundle load event
    publish(bundleId, pathsNotFound);
  }, args.async);
}


/**
 * Execute callbacks when dependencies have been satisfied.
 * @param {(string|string[])} deps - List of bundle ids
 * @param {Object} args - success/fail arguments
 */
loadjs.ready = function (deps, args) {
  // subscribe to bundle load event
  subscribe(deps, function(depsNotFound) {
    // execute callbacks
    if (depsNotFound.length) (args.fail || devnull)(depsNotFound);
    else (args.success || devnull)();
  });
  
  return loadjs;
};


/**
 * Manually satisfy bundle dependencies.
 * @param {string} bundleId - The bundle id
 */
loadjs.done = function done(bundleId) {
  publish(bundleId, []);
};


// export
return loadjs;

}));
