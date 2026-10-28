// Hermes versions used by some Android devices do not implement the ES2023
// Array helpers used by newer React Navigation router releases.
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
