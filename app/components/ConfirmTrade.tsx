import { ModalId, useModalContext } from "@/context/ModalContext";
import {
  Button,
  Dialog,
  DialogBody,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  Icon,
} from "swapr-ui";
import { SLIPPAGE, SwapDirection, SwapState } from ".";
import { useState } from "react";
import { waitForTransactionReceipt, writeContract } from "wagmi/actions";
import MarketABI from "@/abi/market.json";
import {
  CONDITIONAL_TOKEN_CONTRACT_ADDRESS,
  useReadCalcSellAmount,
} from "@/hooks/contracts";
import ConditionalTokensABI from "@/abi/conditionalTokens.json";
import { addFraction, removeFraction } from "@/utils/price";
import { useConfig } from "wagmi";
import { Address, erc20Abi, formatEther, parseEther } from "viem";
import { WXDAI } from "@/constants";
import { TransactionModal } from "./TransactionModal";

const ROUNDING_PRECISON = 0.00000000001;

interface ConfirmTradeProps {
  swapState: SwapState;
  marketId: Address;
  onApprove: Function;
  onSwap: Function;
  outcomeIndex: number;
  swapDirection: SwapDirection;
  tokenAmountIn: string;
  tokenAmountOut?: bigint;
}

export const ConfirmTrade = ({
  swapState,
  marketId,
  onApprove,
  onSwap,
  outcomeIndex,
  swapDirection,
  tokenAmountIn,
  tokenAmountOut,
}: ConfirmTradeProps) => {
  const config = useConfig();
  const { isModalOpen, openModal, closeModal } = useModalContext();
  const [txHash, setTxHash] = useState("");
  const [isTxLoading, setIsTxLoading] = useState(false);
  const { data: sellAmount } = useReadCalcSellAmount(
    marketId,
    formatEther(tokenAmountOut || BigInt(0)),
    outcomeIndex
  );

  const closeBetModal = () => {
    closeModal(ModalId.CONFIRM_SWAP);
  };

  const openTxModal = () => {
    openModal(ModalId.WAITING_TRANSACTION);
  };

  const amountWei = parseEther(tokenAmountIn);
  const twoDecimalsTokenAmountIn = tokenAmountIn
    ? parseFloat(tokenAmountIn).toFixed(2)
    : "";
  const twoDecimalsTokenAmountOut = tokenAmountOut
    ? parseFloat(formatEther(tokenAmountOut)).toFixed(2)
    : "";

  const approveToken = async () => {
    setIsTxLoading(true);

    try {
      const txHash = await writeContract(config, {
        abi: erc20Abi,
        address: WXDAI.address,
        functionName: "approve",
        args: [marketId, amountWei],
      });
      setTxHash(txHash);
      openTxModal();

      await waitForTransactionReceipt(config, {
        hash: txHash,
      });
      onApprove();
    } catch (error) {
      console.error(error);
    } finally {
      setIsTxLoading(false);
    }
  };

  const approveNFT = async () => {
    setIsTxLoading(true);
    try {
      const txHash = await writeContract(config, {
        abi: ConditionalTokensABI,
        address: CONDITIONAL_TOKEN_CONTRACT_ADDRESS,
        functionName: "setApprovalForAll",
        args: [marketId, true],
      });
      setTxHash(txHash);
      openTxModal();

      await waitForTransactionReceipt(config, {
        hash: txHash,
      });
      onApprove();
    } catch (error) {
      console.error(error);
    } finally {
      setIsTxLoading(false);
    }
  };

  const submitBuyBet = async () => {
    setIsTxLoading(true);
    try {
      const txHash = await writeContract(config, {
        abi: MarketABI,
        address: marketId,
        functionName: "buy",
        args: [amountWei, outcomeIndex, tokenAmountOut],
      });
      setTxHash(txHash);
      closeBetModal();
      openTxModal();

      await waitForTransactionReceipt(config, {
        hash: txHash,
      });
      onSwap();
    } catch (error) {
      console.error(error);
    } finally {
      setIsTxLoading(false);
    }
  };

  const submitSellBet = async () => {
    if (!tokenAmountOut || !sellAmount) return;

    setIsTxLoading(true);
    const roundedAmountOut = removeFraction(tokenAmountOut, ROUNDING_PRECISON);
    const maxSellAmount = addFraction(sellAmount as bigint, SLIPPAGE);

    try {
      const txHash = await writeContract(config, {
        abi: MarketABI,
        address: marketId,
        functionName: "sell",
        args: [roundedAmountOut, outcomeIndex, maxSellAmount],
      });
      setTxHash(txHash);
      closeBetModal();
      openTxModal();
      await waitForTransactionReceipt(config, {
        hash: txHash,
      });
      onSwap();
    } catch (error) {
      console.error(error);
    } finally {
      setIsTxLoading(false);
    }
  };

  const confirmState = {
    [SwapDirection.BUY]: { submit: submitBuyBet, approve: approveToken },
    [SwapDirection.SELL]: { submit: submitSellBet, approve: approveNFT },
  };

  const currentConfirmState = confirmState[swapDirection];

  return (
    <>
      <Dialog
        open={isModalOpen(ModalId.CONFIRM_SWAP)}
        onOpenChange={closeBetModal}
      >
        <DialogContent>
          <DialogHeader size="xl" className="text-center">
            <DialogClose position="left" size="xl">
              <Button variant="ghost">
                <Icon name="arrow-left" />
              </Button>
            </DialogClose>
            Confirm Swap
          </DialogHeader>
          <DialogBody className="px-2 space-y-2">
            <div className="relative bg-surface-surface-1 rounded-16">
              <div className="border-b-[1px] border-b-outline-base-em w-full flex flex-col items-center pt-3 pb-8 space-y-1">
                <p className="text-xs uppercase text-text-low-em">You sell</p>
                <div className="text-2xl uppercase">
                  <span>{twoDecimalsTokenAmountIn}</span>{" "}
                  <span className="text-text-low-em">
                    {swapState.inToken.symbol}
                  </span>
                </div>
              </div>
              <div className="flex items-center justify-center rounded-100 bg-surface-surface-3 h-[40px] w-[56px] absolute top-[calc(50%_-_20px)] left-[calc(50%_-_28px)]">
                <Icon name="arrow-down" />
              </div>
              <div className="flex flex-col items-center w-full pt-8 pb-3 space-y-1">
                <p className="text-xs uppercase text-text-low-em">You buy</p>
                <div className="text-2xl uppercase">
                  <span>{twoDecimalsTokenAmountOut}</span>{" "}
                  <span className="text-text-low-em">
                    {swapState.outToken.symbol}
                  </span>
                </div>
              </div>
            </div>
            <div className="border border-outline-base-em rounded-12">
              <div className="px-3 py-1">
                <div className="flex items-center justify-between">
                  <p className=" text-text-low-em">Price</p>
                  <div className="flex items-center space-x-1">
                    <p>1 {swapState.inToken.symbol}</p>
                    <p>=</p>
                    <p className="text-text-success-em">
                      {swapState.tokenPrice} {swapState.outToken.symbol}
                    </p>
                    <p className=" text-text-low-em">(≈ $1)</p>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <p className=" text-text-low-em">Slippage</p>
                  <p>{SLIPPAGE * 100}%</p>
                </div>
              </div>
            </div>
          </DialogBody>
          <DialogFooter>
            {!swapState.isAllowed && (
              <Button
                width="full"
                colorScheme="success"
                variant="pastel"
                onClick={currentConfirmState.approve}
                size="lg"
              >
                Approve
              </Button>
            )}
            <Button
              width="full"
              colorScheme="success"
              variant="pastel"
              onClick={currentConfirmState.submit}
              disabled={!swapState.isAllowed}
              size="lg"
            >
              Confirm Swap
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <TransactionModal isLoading={isTxLoading} txHash={txHash} />
    </>
  );
};
