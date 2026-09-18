"use strict";

function matchPattern(pattern, pathname) {
  const pParts = pattern.split("/").filter(Boolean);
  const uParts = pathname.split("/").filter(Boolean);
  if (pParts.length !== uParts.length) return null;
  const params = {};
  for (let i = 0; i < pParts.length; i++) {
    if (pParts[i].startsWith(":")) {
      params[pParts[i].slice(1)] = decodeURIComponent(uParts[i]);
    } else if (pParts[i] !== uParts[i]) {
      return null;
    }
  }
  return params;
}

class Router {
  constructor() {
    this.routes = [];
  }

  add(method, pattern, handlers) {
    this.routes.push({ method, pattern, handlers });
  }

  get(pattern, ...handlers) {
    this.add("GET", pattern, handlers);
  }
  post(pattern, ...handlers) {
    this.add("POST", pattern, handlers);
  }
  patch(pattern, ...handlers) {
    this.add("PATCH", pattern, handlers);
  }
  delete(pattern, ...handlers) {
    this.add("DELETE", pattern, handlers);
  }

  /** When more than one registered pattern matches the same method+pathname
   *  (a literal route and a :param route can both match the same segment
   *  count), the most specific one wins - i.e. the one with fewer :param
   *  segments - regardless of registration order. Ties keep registration
   *  order. This is defense-in-depth: routes should still be registered
   *  with literals before params for readability, but a future addition
   *  can't silently get shadowed by an existing :param route the way
   *  "/versions/diff" was originally shadowed by "/versions/:id".*/
  findMatch(method, pathname) {
    let best = null;
    let bestParamCount = Infinity;
    for (const route of this.routes) {
      if (route.method !== method) continue;
      const params = matchPattern(route.pattern, pathname);
      if (!params) continue;
      const paramCount = Object.keys(params).length;
      if (paramCount < bestParamCount) {
        best = { route, params };
        bestParamCount = paramCount;
        if (paramCount === 0) break; // can't get more specific than an exact literal match
      }
    }
    return best;
  }

  /** Returns true if a route handled the request, false if nothing matched
   *  (caller should fall through to other handling, e.g. static file serving). */
  async handle(req, res, ctx, pathname) {
    const found = this.findMatch(req.method, pathname);
    if (!found) return false;
    req.params = found.params;
    let idx = 0;
    const handlers = found.route.handlers;
    const next = async () => {
      if (idx >= handlers.length) return;
      const handler = handlers[idx++];
      await handler(req, res, ctx, next);
    };
    await next();
    return true;
  }
}

module.exports = { Router };
