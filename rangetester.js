'use strict'
const lpMath = require('./lpmath.js')

if (!process.argv[2]) die('Data file not provided')
const dataFile = './data/' + process.argv[2] + '.json'

const WEEK = 604800 // it's called WEEK but actually can be arbitrary timeframe
const skipWeeks = 2 // how many timeframes should be skipped (sometimes first day of trading has some big volatity, and it's better to ignore it)

const weekBars = []

const swaps = require(dataFile).swaps
const token0Symbol = require(dataFile).token0 === 'WETH' ? 'ETH' : require(dataFile).token0
const token1Symbol = require(dataFile).token1 === 'WETH' ? 'ETH' : require(dataFile).token1
const reverse = require(dataFile).token0 === 'ETH'
console.log(' ')
console.log(`Backtest for: ${token0Symbol}/${token1Symbol}`)

// verbosity level
const logRebalance = true
const logWeekChange = false
const logSwaps = false

let currWeek = 0
let prevSwap

let dayLow = Infinity
let weekLow = Infinity
let dayHigh = 0
let weekHigh = 0

let dayVolume = 0
let weekVolume = 0
let volumeIn = 0
let compressedVolumeIn = 0
let totalVolume = 0
let totalFees = 0
let totalCapturedFees = 0
let weekFees = 0
let totalAmp = 0

let totalPureIL = 1
let totalIL = 1

const feeLevel = 0.003

const multi = 1.221 // this is used to multiple range width by some amount
const initCapital = 135 // the capital which is needed to achieve some poolShare, in ETH, both sides (token + ETH)
const poolShare = 0.01 // share in pool (v2 style), corresponding to some amount of capital defined by initCapital

let capital = initCapital
let netCapital = initCapital
let liquidity

let prevWeekOpenPrice = price(swaps[0])
let start = swaps[0].timestamp

let lastPrice
let firstToken0Investment = 0

//const top = previousWeekATRPercentTop
//const bottom = previousWeekATRPercentBottom
const top = percentTop // function that defines top of the trading range
const bottom = percentBottom // function that defines bottom of the trading range

let rangeTop
let rangeBottom

let prevInCapital
let token0, token1
for (const swap of swaps) {
  const currPrice = price(swap)
  if (currPrice === Infinity) continue
  const now = new Date(swap.timestamp * 1000)

  if (prevSwap) if (Math.floor((swap.timestamp - start) / WEEK) !== Math.floor((prevSwap.timestamp - start) / WEEK)) newWeek(swap)

  if (currWeek >= skipWeeks) {
    // skipping 2 first weeks, first, because it has no data to compute the ranged, second, because the H/L data from first week can be flawed
    if (rangeDefined(rangeTop, rangeBottom)) {
      totalVolume = totalVolume + volume(swap)
      totalFees = totalFees + volume(swap) * poolShare * feeLevel
      if (inRange(currPrice, rangeTop, rangeBottom)) {
        if (logSwaps) console.log(`${now.toISOString()}: [${currWeek}] ${rangeBottom} > ${currPrice} < ${rangeTop}, wH: ${weekHigh}`)
        volumeIn = volumeIn + volume(swap)
        compressedVolumeIn = compressedVolumeIn + volume(swap) * compression(rangeBottom, rangeTop)
        totalCapturedFees = totalCapturedFees + volume(swap) * poolShare * feeLevel * compression(rangeBottom, rangeTop)
        weekFees = weekFees + volume(swap) * poolShare * feeLevel * compression(rangeBottom, rangeTop)
      } else {
        if (logSwaps) console.log(`${now.toISOString()}: [${currWeek}] ${rangeBottom} ~ ${currPrice} ~ ${rangeTop}, wH: ${weekHigh}`)
      }
    } else {
      console.log('*** Range undefined')
    }
  } else {
    // console.log(`*** Not counting volume in week: ${currWeek}`)
  }

  dayHigh = Math.max(currPrice, dayHigh)
  weekHigh = Math.max(currPrice, weekHigh)
  dayLow = Math.min(currPrice, dayLow)
  weekLow = Math.min(currPrice, weekLow)
  dayVolume = dayVolume + volume(swap)
  weekVolume = weekVolume + volume(swap)
  prevSwap = swap
  lastPrice = currPrice
}
console.log('---')
console.log(`Weeks: ${currWeek}`)
console.log(`Initial capital ${initCapital} ETH, pool share: ${poolShare * 100}%`)
console.log(`Multiplier: ${multi}`)
console.log(`VIR: ${volumeIn.toFixed(0)}, CVIR ${compressedVolumeIn.toFixed(0)}, V: ${totalVolume.toFixed(0)}`)
console.log(`VIR/V: ${((volumeIn / totalVolume) * 100).toFixed(2)}%, CVIR/V: ${((compressedVolumeIn / totalVolume) * 100).toFixed(2)}%`)
console.log(`Fees: ${totalFees.toFixed(2)} ${token1Symbol}, fees per week/capital: ${((totalFees / (currWeek - skipWeeks)) / capital).toFixed(4)} ETH`)
console.log(`Avg amplifier: ${(totalAmp / currWeek).toFixed(2)}x`)
console.log(`Captured fees: ${totalCapturedFees.toFixed(2)} ${token1Symbol}, captured fees per week/capital: ${((totalCapturedFees / (currWeek - skipWeeks)) / capital).toFixed(4)} ETH`)
const holdPL = ((firstToken0Investment * lastPrice + initCapital / 2) - initCapital) / initCapital
console.log(`Hodl P/L: ${(100 * holdPL).toFixed(2)}%`)
const finalPL = (capital - initCapital) / initCapital
console.log(`End capital: ${capital.toFixed(2)} ${token1Symbol}, P/L: ${(100 * finalPL).toFixed(2)}%`)
const strategyImpact = (capital - (firstToken0Investment * lastPrice + initCapital / 2)) / (firstToken0Investment * lastPrice + initCapital / 2)
console.log(`Strategy impact: ${(100 * strategyImpact).toFixed(2)}%`)

function rebalance () {
  if (logRebalance) console.log(`Rebalance for week: ${currWeek}`)
  const closePrice = price(prevSwap)
  const openPrice = prevWeekOpenPrice
  if (liquidity) {
    const prevWeekCapital = token0 * closePrice + token1

    token0 = lpMath.getAmountsForLiquidity(Math.sqrt(closePrice), Math.sqrt(rangeBottom), Math.sqrt(rangeTop), liquidity)[0]
    token1 = lpMath.getAmountsForLiquidity(Math.sqrt(closePrice), Math.sqrt(rangeBottom), Math.sqrt(rangeTop), liquidity)[1]

    capital = token0 * closePrice + token1 + weekFees
    netCapital = token0 * closePrice + token1

    const weekIL = (netCapital / prevWeekCapital) - 1
    const weekPL = (capital / prevInCapital) - 1
    const netWeekPL = (netCapital / prevInCapital) - 1
    const weekYield = weekFees / capital
    if (logRebalance) console.log(` out: ${token0.toFixed(2)} ${token0Symbol} + ${token1.toFixed(2)} ${token1Symbol} = ${capital.toFixed(2)} ${token1Symbol} vs HODL: ${prevInCapital.toFixed(2)} ${token1Symbol}, fees: ${weekFees.toFixed(2)}, yield: ${(weekYield * 100).toFixed(2)}% (${(weekIL * 100).toFixed(2)}%/${(netWeekPL * 100).toFixed(2)}%/${(weekPL * 100).toFixed(2)}%)`)
    totalIL = totalIL * (1 + weekPL)
    totalPureIL = totalPureIL * (1 + netWeekPL)
  }
  rangeTop = top(currWeek, prevWeekOpenPrice, multi)
  rangeBottom = bottom(currWeek, prevWeekOpenPrice, multi)
  rangeBottom = rangeBottom < 0 ? 0 : rangeBottom

  liquidity = lpMath.getLiquidityForAmounts(Math.sqrt(prevWeekOpenPrice), Math.sqrt(rangeBottom), Math.sqrt(rangeTop), (capital / 2) / prevWeekOpenPrice, capital / 2)
  token0 = lpMath.getAmountsForLiquidity(Math.sqrt(prevWeekOpenPrice), Math.sqrt(rangeBottom), Math.sqrt(rangeTop), liquidity)[0]
  token1 = lpMath.getAmountsForLiquidity(Math.sqrt(prevWeekOpenPrice), Math.sqrt(rangeBottom), Math.sqrt(rangeTop), liquidity)[1]
  prevInCapital = token0 * prevWeekOpenPrice + token1
  firstToken0Investment = firstToken0Investment === 0 ? token0 : firstToken0Investment
  totalAmp = totalAmp + compression(rangeBottom, rangeTop)
  if (logRebalance) console.log(` in ${prevWeekOpenPrice}: ${token0.toFixed(2)} ${token0Symbol} + ${token1.toFixed(2)} ${token1Symbol} = ${prevInCapital.toFixed(2)} ${token1Symbol} in ${rangeBottom.toFixed(6)}..${rangeTop.toFixed(6)} range -> amplifier: ${compression(rangeBottom, rangeTop).toFixed(2)}x`)
}

function newWeek (swap) {
  const closePrice = price(prevSwap)
  const openPrice = prevWeekOpenPrice

  if (logWeekChange) console.log(`Creating bars for week: ${currWeek}, price: ${closePrice.toFixed(6)} ${token0Symbol}/${token1Symbol}`)

  if (Math.max(openPrice, weekLow, closePrice) > weekHigh) die('week too high')
  if (Math.min(openPrice, weekHigh, closePrice) < weekLow) die('week too low')
  weekBars.push({ n: currWeek, O: openPrice, H: weekHigh, L: weekLow, C: closePrice, volume: weekVolume })
  // console.log(`Bar: n: ${currWeek}, O: ${openPrice}, H: ${weekHigh}, L: ${weekLow}, C: ${closePrice}, volume: ${weekVolume}`)
  currWeek++
  prevWeekOpenPrice = price(swap)

  if (currWeek >= skipWeeks) {
    rebalance()
  } else {
    if (logRebalance) console.log(`Skipping rebalance: ${currWeek}`)
  }

  weekLow = Infinity
  weekHigh = 0
  weekVolume = 0
  weekFees = 0

  if (logWeekChange) console.log(`Next week: ${currWeek}, price: ${prevWeekOpenPrice.toFixed(6)} ${token0Symbol}/${token1Symbol}`)
}

function compression (bottom, top) {
  return 1 / (1 - (bottom / top) ** (1 / 4))
}

// range based on previous week high and low
function previousWeekHigh (week) {
  return week > 0 ? weekBars[week - 1].H : undefined
}
function previousWeekLow (week) {
  return week > 0 ? weekBars[week - 1].L : undefined
}

// range based on previous week volatility * multiplier
function previousWeekATRPercentTop (week, basePrice, multiplier = 1) {
  if (week < 1) return undefined
  const TR = weekBars[week - 1].H - weekBars[week - 1].L
  return basePrice + TR / (2 / multiplier)
}
function previousWeekATRPercentBottom (week, basePrice, multiplier = 1) {
  if (week < 1) return undefined
  const TR = weekBars[week - 1].H - weekBars[week - 1].L
  const rangeTop = basePrice + TR / (2 / multiplier)
  const ratio = rangeTop / basePrice
  // console.log(basePrice, TR, rangeTop, basePrice / ratio)
  return basePrice / ratio
}

// range based on current price multiplied/divided by some multiplier

function percentTop (week, basePrice, multiplier = 1) {
  return basePrice * multiplier
}
function percentBottom (week, basePrice, multiplier = 1) {
  return basePrice / multiplier
}

function rangeDefined (rangeTop, rangeBottom) {
  return (rangeTop && rangeBottom)
}

function inRange (price, rangeTop, rangeBottom) {
  return ((price <= rangeTop) && (price >= rangeBottom))
}

function volume (swap) {
  if (!reverse) {
    return Math.max(swap.amount1In, swap.amount1Out)
  } else {
    return Math.max(swap.amount0In, swap.amount0Out)
  }
}

function price (swap) {
  if (!reverse) {
    return swap.amount0In ? swap.amount1Out / swap.amount0In : swap.amount1In / swap.amount0Out
  } else {
    return swap.amount0In ? swap.amount0In / swap.amount1Out : swap.amount0Out / swap.amount1In
  }
}
function die (why) {
  console.error(why)
  process.exit(1)
}
