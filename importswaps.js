'use strict'

const fs = require('fs')
const axios = require('axios')

// const GRAPH = 'https://api.thegraph.com/subgraphs/name/benesjan/uniswap-v2'
const GRAPH = 'https://api.thegraph.com/subgraphs/name/uniswap/uniswap-v2'

const pair = process.argv[2]
if (!pair) die('Contract address not provided')

let lastTimestamp = '0'
const step = 1000
var reverse
let allSwaps = []
let swaps
let pairTokens
let token0, token1
let retry = false

;(async () => {
  const pairQuery = `{
    pair(id: "${pair}"){
        token0 {
          symbol
          name
        }
        token1 {
          symbol
          name
        }
      }
   }
  `
  try {
    const rawPair = await axios.post(GRAPH, { query: pairQuery })
    pairTokens = (rawPair.data.data.pair)
    token0 = pairTokens.token0.symbol
    reverse = (token0 === 'WETH')
    token1 = pairTokens.token1.symbol
    console.log(`Pair: ${token0}-${token1} ${reverse ? 'reverse' : ''}`)
  } catch (error) {
    die(error)
  }

  do {
    const swapsQuery = `{
      swaps(first: ${step}, orderBy: timestamp, orderDirection: asc, where: { pair: "${pair}", timestamp_gt: "${lastTimestamp}"}) {
        transaction {
          blockNumber
        }
        timestamp
        amount0In
        amount0Out
        amount1In
        amount1Out
        amountUSD
      }
    }
    `
    try {
      console.log(`${lastTimestamp}`)
      const rawSwaps = await axios.post(GRAPH, { query: swapsQuery })
      if (rawSwaps.status !== 200) {
        die(rawSwaps)
      }
      if (rawSwaps.data.data) {
        swaps = rawSwaps.data.data.swaps
        if (!reverse) {
          swaps = swaps.map(swap => {
            return ({ amount0In: parseFloat(swap.amount0In), amount0Out: parseFloat(swap.amount0Out), amount1In: parseFloat(swap.amount1In), amount1Out: parseFloat(swap.amount1Out), timestamp: parseInt(swap.timestamp), blockNumber: parseInt(swap.transaction.blockNumber) })
          })
        } else {
          swaps = swaps.map(swap => {
            return ({ amount0In: parseFloat(swap.amount1In), amount0Out: parseFloat(swap.amount1Out), amount1In: parseFloat(swap.amount0In), amount1Out: parseFloat(swap.amount0Out), timestamp: parseInt(swap.timestamp), blockNumber: parseInt(swap.transaction.blockNumber) })
          })
        }
        if (rawSwaps.data.data.swaps.length) {
          allSwaps = [...allSwaps, ...swaps]
          lastTimestamp = swaps[swaps.length - 1].timestamp
        }
        retry = false
      } else {
        if (allSwaps[allSwaps.length - 1].timestamp < (Date.now() / 1000) - 60 * 60) {
          console.log('Retrying...')
          retry = true
        } else {
          swaps = []
          retry = false
        }
      }
    } catch (error) {
      die(error)
    }
  }
  while (swaps.length || retry)
  console.log('Saving data')
  const output = {}
  output.address = pair
  output.token0 = reverse ? token1 : token0
  output.token1 = reverse ? token0 : token1
  output.swaps = allSwaps
  fs.writeFileSync(`./data/${output.token0}.json`, JSON.stringify(output, undefined, ' '))
  console.log('Done')
})()

function die (why) {
  console.error(why)
  process.exit(1)
}
