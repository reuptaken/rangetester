Simple backtester for Uniswap v3 concentrated liquidity vs Uniswap v2 data.

Usage: `node rangetester.js SYMBOL` (eg. `node rangetester.js MKR`) – the input data for each pair has to be downloaded first using `node importswaps.js POOL_ADDRESS` to `./data/` directory (please create it first!). 

Then define some parameters for test directly in script (see comments.)

It works like this:

1. When "week" starts capital is allocated in middle of the range defined by `top` and `bottom` functions. Amplifier is calculated based on range.
2. During the "week" fees are collected according to historical trades data. Only trades that fall into range are considered. Fees are calculated according to pool share and multiplied by amplifier.
3. At the end of the "week" both tokens are taken out of pool (it will be a capital for the next week). Fees collected during week are added to the capital. Those rather cryptic numbers, eg. `(-0.23%/-2.25%/1.78%)` are: impermanent loss for the week (always a negative number) / week profit/loss excluding fees / week profit/loss including fees.

At the end of the backtest there are some numbers presented. Most of them are self-explanatory, but some are not. All numbers are in ETH not USD (unless it's explicitly specified)

`VIR` – Volume In Range (how much of total volume (`V`) was in range and generated fees)
`CVIR` – it's `VIR * amplifier`
`VIR/V` – how much % of volume was captured

`Strategy impact` – what was the impact of providing liquidity (this allows you to compare between pools disregarding change of token/ETH price)