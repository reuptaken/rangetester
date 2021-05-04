const { default: NormalDistribution } = require('normal-distribution')
const lpMath = require('./lpmath.js')
require("normal-distribution")

nd = new NormalDistribution(0, 1)

const capital = 100
const change = 2/3
const yield = 10 * 0.003
let capture = 1 - 0.682

for (let i = 2; i <= 2000; i = i * 2) {
  const price = Math.sqrt(i)
  const changedPrice = Math.sqrt(i) * change
  let liquidity = lpMath.getLiquidityForAmounts(Math.sqrt(Math.sqrt(i)), Math.sqrt(1), Math.sqrt(i), (capital / 2) / price, capital / 2)
  let token0 = lpMath.getAmountsForLiquidity(Math.sqrt(changedPrice), Math.sqrt(1), Math.sqrt(i), liquidity)[0]
  let token1 = lpMath.getAmountsForLiquidity(Math.sqrt(changedPrice), Math.sqrt(1), Math.sqrt(i), liquidity)[1]
  const nowValue = token0 * changedPrice + token1
  const holdValue = ((capital / 2) / price) * changedPrice + (capital / 2)
  console.log(`${i}`)
  console.log(` boost=${(compression(1, i)).toFixed(2)} * yield=${yield} * capture=${(1 - capture).toFixed(2)} => ${(100 * (compression(1, i) * yield * (1 - capture))).toFixed(2)}%`)
  console.log(` range: 1..${i} ${price.toFixed(2)} -> ${changedPrice.toFixed(2)}, IL = ${(100 * ((nowValue - holdValue) / holdValue)).toFixed(2)}%`)
  console.log(` ${((nowValue - holdValue) / holdValue) / (compression(1, i) * yield * (1 - capture)).toFixed(2)}`)
  capture = (capture + capture / Math.E) / Math.E
}

function compression (bottom, top) {
  return 1 / (1 - (bottom / top) ** (1 / 4))
}


function stdNormalDistribution (x) {
  return Math.pow(Math.E, -Math.pow(x,2) / 2) / Math.sqrt(2*Math.PI);
}