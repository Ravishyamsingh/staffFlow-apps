// Hermes versions used by some Android devices do not implement all of the
// ES2019/ES2023 helpers used by newer React Navigation router releases.
if (!Object.fromEntries) {
  Object.fromEntries = function fromEntries(entries) {
    const result = {};
    for (const entry of entries) {
      result[entry[0]] = entry[1];
    }
    return result;
  };
}

if (!Array.prototype.flat) {
  Object.defineProperty(Array.prototype, "flat", {
    configurable: true,
    value: function flat(depth = 1) {
      const result = [];
      const flatten = (items, level) => {
        for (const item of items) {
          if (Array.isArray(item) && level > 0) flatten(item, level - 1);
          else result.push(item);
        }
      };
      flatten(this, depth);
      return result;
    },
  });
}

if (!Array.prototype.flatMap) {
  Object.defineProperty(Array.prototype, "flatMap", {
    configurable: true,
    value: function flatMap(callback, thisArg) {
      return this.map(callback, thisArg).flat(1);
    },
  });
}

if (!Array.prototype.findLast) {
  Object.defineProperty(Array.prototype, "findLast", {
    configurable: true,
    value: function findLast(predicate, thisArg) {
      for (let index = this.length - 1; index >= 0; index -= 1) {
        if (predicate.call(thisArg, this[index], index, this)) return this[index];
      }
      return undefined;
    },
  });
}

if (!Array.prototype.findLastIndex) {
  Object.defineProperty(Array.prototype, "findLastIndex", {
    configurable: true,
    value: function findLastIndex(predicate, thisArg) {
      for (let index = this.length - 1; index >= 0; index -= 1) {
        if (predicate.call(thisArg, this[index], index, this)) return index;
      }
      return -1;
    },
  });
}
