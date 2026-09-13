export { getChainConfig, CHAINS, CONTRACT_OWNER, BASE_SEPOLIA_ID, ARC_TESTNET_ID } from './chains'

/** @deprecated Use getChainConfig(chainId).market — Base Sepolia fallback */
export const MARKET_ADDRESS    = import.meta.env.VITE_MARKET_CONTRACT  || '0x20FB4e706365FeF2Dd22Ddcd15987E695F6f637E'
/** @deprecated Use getChainConfig(chainId).usdc */
export const USDC_ADDRESS      = import.meta.env.VITE_USDC_ADDRESS      || '0x036CbD53842c5426634e7929541eC2318f3dCF7e'
export const CHAINLINK_BTC_USD = '0x0FB99723Aee6f420beAD13e6bBB79b7E6F034298'

export const STATUS      = { OPEN: 0, LIVE: 1, SETTLED: 2, CANCELLED: 3 }
export const OPTION      = { UP: 1, DOWN: 2, DRAW: 3, TEAM_A: 1, TEAM_B: 2 }
export const MARKET_TYPE = { BTC_PRICE: 0, SPORTS_MATCH: 1 }

export const DURATIONS = [
  { label: '5m',  secs: 300   },
  { label: '10m', secs: 600   },
  { label: '15m', secs: 900   },
  { label: '30m', secs: 1800  },
  { label: '1h',  secs: 3600  },
  { label: '4h',  secs: 14400 },
]

export function fmtDuration(secs) {
  if (secs < 60)   return `${secs}s`
  if (secs < 3600) return `${Math.round(secs / 60)}m`
  return `${secs / 3600}h`
}

// Team flag lookup for sports markets
export const FLAGS = {
  // World Cup 2026 confirmed + major nations
  'Argentina':'🇦🇷','Australia':'🇦🇺','Belgium':'🇧🇪','Bolivia':'🇧🇴',
  'Brazil':'🇧🇷','Cameroon':'🇨🇲','Canada':'🇨🇦','Chile':'🇨🇱',
  'Colombia':'🇨🇴','Costa Rica':'🇨🇷','Croatia':'🇭🇷','Czech Republic':'🇨🇿',
  'Denmark':'🇩🇰','Ecuador':'🇪🇨','Egypt':'🇪🇬','El Salvador':'🇸🇻',
  'England':'🏴󠁧󠁢󠁥󠁮󠁧󠁿','France':'🇫🇷','Germany':'🇩🇪','Ghana':'🇬🇭',
  'Greece':'🇬🇷','Honduras':'🇭🇳','Hungary':'🇭🇺','Indonesia':'🇮🇩',
  'Iran':'🇮🇷','Iraq':'🇮🇶','Israel':'🇮🇱','Italy':'🇮🇹',
  'Ivory Coast':'🇨🇮','Jamaica':'🇯🇲','Japan':'🇯🇵','Jordan':'🇯🇴',
  'Kenya':'🇰🇪','Mali':'🇲🇱','Mexico':'🇲🇽','Morocco':'🇲🇦',
  'Netherlands':'🇳🇱','New Zealand':'🇳🇿','Nicaragua':'🇳🇮','Nigeria':'🇳🇬',
  'Norway':'🇳🇴','Panama':'🇵🇦','Paraguay':'🇵🇾','Peru':'🇵🇪',
  'Poland':'🇵🇱','Portugal':'🇵🇹','Qatar':'🇶🇦','Romania':'🇷🇴',
  'Saudi Arabia':'🇸🇦','Scotland':'🏴󠁧󠁢󠁳󠁣󠁴󠁿','Senegal':'🇸🇳','Serbia':'🇷🇸',
  'Slovakia':'🇸🇰','Slovenia':'🇸🇮','South Africa':'🇿🇦','South Korea':'🇰🇷',
  'Spain':'🇪🇸','Sweden':'🇸🇪','Switzerland':'🇨🇭','Trinidad and Tobago':'🇹🇹',
  'Tunisia':'🇹🇳','Turkey':'🇹🇷','Ukraine':'🇺🇦','Uruguay':'🇺🇾',
  'USA':'🇺🇸','Venezuela':'🇻🇪','Wales':'🏴󠁧󠁢󠁷󠁬󠁳󠁿','Zambia':'🇿🇲',
  // Club teams (Champions League, Premier League, etc.)
  'Arsenal':'🔴','Aston Villa':'🟣','Barcelona':'🔵','Bayern Munich':'🔴',
  'Boca Juniors':'💙','Borussia Dortmund':'🟡','Chelsea':'🔵','Everton':'🔵',
  'Inter Milan':'⚫','Juventus':'⚫','Liverpool':'🔴','Man City':'🩵',
  'Man United':'🔴','Milan':'🔴','Napoli':'🩵','Newcastle':'⚫',
  'Paris Saint-Germain':'🔵','PSG':'🔵','Real Madrid':'⚪','River Plate':'⚪',
  'Tottenham':'⚪','West Ham':'🟣',
}

// Parse "TeamA vs TeamB | Competition" question format
export function parseSportsQuestion(question) {
  const [teamsPart, competition = ''] = question.split(' | ')
  const [teamA, teamB = ''] = teamsPart.split(' vs ')
  return { teamA: teamA?.trim(), teamB: teamB?.trim(), competition: competition.trim() }
}

export const MARKET_ABI = [
  {
    name: 'createMarket',
    type: 'function',
    inputs: [
      { name: 'marketType',    type: 'uint8'   },
      { name: 'question',      type: 'string'  },
      { name: 'duration',      type: 'uint256' },
      { name: 'initialOption', type: 'uint8'   },
      { name: 'initialAmount', type: 'uint256' },
      { name: 'oracleAddress', type: 'address' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    name: 'joinMarket',
    type: 'function',
    inputs: [
      { name: 'marketId', type: 'uint256' },
      { name: 'option',   type: 'uint8'   },
      { name: 'amount',   type: 'uint256' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    name: 'settleMarket',
    type: 'function',
    inputs: [{ name: 'marketId', type: 'uint256' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    name: 'withdraw',
    type: 'function',
    inputs: [{ name: 'marketId', type: 'uint256' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    name: 'refund',
    type: 'function',
    inputs: [{ name: 'marketId', type: 'uint256' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    name: 'createSportsMarket',
    type: 'function',
    inputs: [
      { name: 'question',  type: 'string'  },
      { name: 'duration',  type: 'uint256' },
      { name: 'option',    type: 'uint8'   },
      { name: 'amount',    type: 'uint256' },
      { name: 'fixtureId', type: 'uint256' },
    ],
    outputs: [{ name: 'marketId', type: 'uint256' }],
    stateMutability: 'nonpayable',
  },
  {
    name: 'requestSportsResult',
    type: 'function',
    inputs: [{ name: 'marketId', type: 'uint256' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    name: 'resolveSportsMarket',
    type: 'function',
    inputs: [
      { name: 'marketId',      type: 'uint256' },
      { name: 'winningOption', type: 'uint8'   },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    name: 'owner',
    type: 'function',
    inputs: [],
    outputs: [{ name: '', type: 'address' }],
    stateMutability: 'view',
  },
  {
    name: 'marketCount',
    type: 'function',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    name: 'getPosition',
    type: 'function',
    inputs: [
      { name: 'marketId',    type: 'uint256' },
      { name: 'participant', type: 'address' },
    ],
    outputs: [
      { name: 'amount',    type: 'uint256' },
      { name: 'option',    type: 'uint8'   },
      { name: 'withdrawn', type: 'bool'    },
    ],
    stateMutability: 'view',
  },
]

export const USDC_ABI = [
  {
    name: 'approve',
    type: 'function',
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'amount',  type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'nonpayable',
  },
  {
    name: 'allowance',
    type: 'function',
    inputs: [
      { name: 'owner',   type: 'address' },
      { name: 'spender', type: 'address' },
    ],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    name: 'balanceOf',
    type: 'function',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
]
