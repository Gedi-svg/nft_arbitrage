export const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

export const WETH_ADDRESS_MAINNET = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2";
export const WETH_ADDRESS_RINKEBY = "0xc778417E063141139Fce010982780140Aa0cD5Ab";
export const WETH_ADDRESS_ARBITRUM = "0x82af49447d8a07e3bd95bd0d56f35241523fbab1";
export const OPENSEA_ADDRESS_RINKEBY = "0xdD54D660178B28f6033a953b0E55073cFA7e3744";

export const OPENSEA_SEAPORT_1_1_MAINNET = '0x00000000006c3852cbEf3e08E8dF289169EdE581';

// some NFT collections
export const BAYC_COLLECTION_MAINNET = '0xbc4ca0eda7647a8ab7c2061c2e118a18a936f13d';
export const ENS_COLLECTION_MAINNET = '0x57f1887a8bf19b14fc0df6fd9b2acc9af147ea85';


export const WETH_ADDRESS : {[chainId: number] : string} = {
  1 : WETH_ADDRESS_MAINNET,
  4 : WETH_ADDRESS_RINKEBY,
  42161 : WETH_ADDRESS_ARBITRUM,
};