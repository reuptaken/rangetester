'use strict'

const Q96 = 1

function mulDiv (a, b, multiplier) {
  return a * b / multiplier
}

function getLiquidityForAmount0 (sqrtRatioAX96, sqrtRatioBX96, amount0) {
  if (sqrtRatioAX96 > sqrtRatioBX96) [sqrtRatioAX96, sqrtRatioBX96] = [sqrtRatioBX96, sqrtRatioAX96]
  const intermediate = mulDiv(sqrtRatioAX96, sqrtRatioBX96, Q96)
  return mulDiv(amount0, intermediate, sqrtRatioBX96 - sqrtRatioAX96)
}

function getLiquidityForAmount1 (sqrtRatioAX96, sqrtRatioBX96, amount1) {
  if (sqrtRatioAX96 > sqrtRatioBX96) [sqrtRatioAX96, sqrtRatioBX96] = [sqrtRatioBX96, sqrtRatioAX96]
  return mulDiv(amount1, Q96, sqrtRatioBX96 - sqrtRatioAX96)
}

function getLiquidityForAmounts (sqrtRatioX96, sqrtRatioAX96, sqrtRatioBX96, amount0, amount1) {
  let liquidity
  if (sqrtRatioAX96 > sqrtRatioBX96) [sqrtRatioAX96, sqrtRatioBX96] = [sqrtRatioBX96, sqrtRatioAX96]
  if (sqrtRatioX96 <= sqrtRatioAX96) {
    liquidity = getLiquidityForAmount0(sqrtRatioAX96, sqrtRatioBX96, amount0)
  } else {
    if (sqrtRatioX96 < sqrtRatioBX96) {
      const liquidity0 = getLiquidityForAmount0(sqrtRatioX96, sqrtRatioBX96, amount0)
      const liquidity1 = getLiquidityForAmount1(sqrtRatioAX96, sqrtRatioX96, amount1)
      liquidity = liquidity0 < liquidity1 ? liquidity0 : liquidity1
    } else {
      liquidity = getLiquidityForAmount1(sqrtRatioAX96, sqrtRatioBX96, amount1)
    }
  }
  return liquidity
}

function getAmount0ForLiquidity (sqrtRatioAX96, sqrtRatioBX96, liquidity) {
  if (sqrtRatioAX96 > sqrtRatioBX96) [sqrtRatioAX96, sqrtRatioBX96] = [sqrtRatioBX96, sqrtRatioAX96]
  return mulDiv(liquidity, sqrtRatioBX96 - sqrtRatioAX96, sqrtRatioBX96) / sqrtRatioAX96
}

function getAmount1ForLiquidity (sqrtRatioAX96, sqrtRatioBX96, liquidity) {
  if (sqrtRatioAX96 > sqrtRatioBX96) [sqrtRatioAX96, sqrtRatioBX96] = [sqrtRatioBX96, sqrtRatioAX96]
  return mulDiv(liquidity, sqrtRatioBX96 - sqrtRatioAX96, Q96)
}

function getAmountsForLiquidity (sqrtRatioX96, sqrtRatioAX96, sqrtRatioBX96, liquidity) {
  let amount0
  let amount1
  if (sqrtRatioAX96 > sqrtRatioBX96) [sqrtRatioAX96, sqrtRatioBX96] = [sqrtRatioBX96, sqrtRatioAX96]
  if (sqrtRatioX96 <= sqrtRatioAX96) {
    amount0 = getAmount0ForLiquidity(sqrtRatioAX96, sqrtRatioBX96, liquidity)
    amount1 = 0
  } else if (sqrtRatioX96 < sqrtRatioBX96) {
    amount0 = getAmount0ForLiquidity(sqrtRatioX96, sqrtRatioBX96, liquidity)
    amount1 = getAmount1ForLiquidity(sqrtRatioAX96, sqrtRatioX96, liquidity)
  } else {
    amount0 = 0
    amount1 = getAmount1ForLiquidity(sqrtRatioAX96, sqrtRatioBX96, liquidity)
  }
  return [amount0, amount1]
}

exports.getLiquidityForAmounts = getLiquidityForAmounts
exports.getAmountsForLiquidity = getAmountsForLiquidity
