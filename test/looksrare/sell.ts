import { addressesByNetwork, SupportedChainId } from "@looksrare/sdk";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { BigNumber, Wallet } from "ethers";
import { formatEther } from "ethers/lib/utils";
import { ethers } from "hardhat";
import { LooksRareApiClient } from "../../src/external_order_signature/api/looksrare_api";
import { Order } from "../../src/external_order_signature/model/looksrare_model";
import { Flashbots } from "../../src/flashbots/Flashbots";
import { LooksRareTxnUtils, LOOKSRARE_ERC721_TRANSFER_MANAGER_CONTRACT_ETHEREUM } from "../../src/looksrare_interactions/looksrare_txns_utils";
import { ERC721__factory, LooksRareExchange__factory, Weth9__factory } from "../../typechain_types";
import { WETH_ADDRESS } from "../constants/addresses";
import { GWEI } from "../constants/ether";
import { ONE_MINUTE_IN_MILLIS } from "../constants/time";

const useFlashbots = false;

export async function sell(chainId: SupportedChainId, collectionAddress: string,
  token_id: string, externalAccount: SignerWithAddress) {

  const lrc = new LooksRareApiClient(chainId);
  const spreadInfo = await lrc.getSpreadsOfNfts(collectionAddress, [Number(token_id)], false);

  const _allBids = spreadInfo.results[0].bidsAsks.allBids;

  // filter out orders that are about to expire
  // NOTE: this is not a good practice, but for demo purposes it's ok
  // TODO: remove this when implementing a real solution
  const allBids = _allBids.filter((item) => {
    return (item.endTime ?? 0) * 1000 > Date.now() + ONE_MINUTE_IN_MILLIS;
  });

  const wethTokenContract = Weth9__factory.connect(WETH_ADDRESS[chainId], ethers.provider);

  console.log("bids:", allBids.length);
  let i = 0;
  let bestBid: Order | null = null;
  while (i < allBids.length) {
    const bid = allBids[i];
    const bidderBalance = await wethTokenContract.balanceOf(bid.signer!);
    console.log(`Bidder ${bid.signer!} bid ${formatEther(bid.price!)} and has a WETH balance of ${formatEther(bidderBalance)}`);
    i++;
    if (bidderBalance.gte(bid.price!)) {
      bestBid = bid;
      break;
    }
  }

  if (bestBid == null) {
    throw new Error(`No valid bids found for tokenId ${token_id}`);
  }

  // console.log(JSON.stringify(bestBid));

  const erc721Contract = ERC721__factory.connect(collectionAddress,
    ethers.provider);


  //await erc721Contract.connect(externalAccount).approve(looksRareExchangeContract.address,
  //  tokenId);
  if (await erc721Contract.connect(externalAccount).isApprovedForAll(externalAccount.address,
    LOOKSRARE_ERC721_TRANSFER_MANAGER_CONTRACT_ETHEREUM) === false) {
    console.log("Approving looksrare to move our NFTs");
    await erc721Contract.connect(externalAccount).setApprovalForAll(
      LOOKSRARE_ERC721_TRANSFER_MANAGER_CONTRACT_ETHEREUM,
      true
    );
  }

  const n_nfts = await erc721Contract.balanceOf(externalAccount.address);
  const prev_weth_balance = await wethTokenContract.balanceOf(externalAccount.address);

  console.log("Sending the sell txn");
  // TODO: get royalty info from the contract (calculateRoyaltyFeeAndGetRecipient)
  // and also update it regularly (usually only depends on the collection and usually 
  // doesn't change)
  const sellingFeesOver10k = BigNumber.from(200).add(750); // fees + royalties
  const addresses = addressesByNetwork[chainId];
  const looksrareExchangeContract = LooksRareExchange__factory.connect(addresses.EXCHANGE, ethers.provider);
  const pst = await LooksRareTxnUtils.prepareSellNftTransaction(
    looksrareExchangeContract,
    token_id.toString(),
    bestBid,
    BigNumber.from(10_000).sub(sellingFeesOver10k), // 1 - slippage
    externalAccount.address, // must be msg.sender
  );

  if (useFlashbots) {
    const fl = new Flashbots(ethers.provider);
    const gas = await externalAccount.estimateGas({
      to: pst.target,
      data: pst.payload,
    });
    await fl.sendRegularTxn(pst.populatedTransaction,
      (externalAccount as any) as Wallet, // TODO: in production find a way to make sure 
      // this is a wallet (we can't use hardhat impersonated accounts here)
      gas.mul(3).div(2), // 1.5 times the estimated gas
      GWEI.mul(2),
    );
  } else {
    await externalAccount.sendTransaction({
      to: pst.target,
      data: pst.payload,
    });
  }


  const n_nfts_2 = await erc721Contract.balanceOf(externalAccount.address);
  const after_weth_balance = await wethTokenContract.balanceOf(externalAccount.address);

  if (!n_nfts.sub(n_nfts_2).eq(1)) {
    throw new Error(`sell txn failed, NFT still owned by ${externalAccount.address}`);
  }

  const received = after_weth_balance.sub(prev_weth_balance);

  console.log("Sell successful! 👌 for ", formatEther(received), " WETH");

  return received;
}