;(BigInt.prototype as any).toJSON = function () {
  return Number(this)
}
