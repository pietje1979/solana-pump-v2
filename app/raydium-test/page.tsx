"use client";

import { useMemo, useState } from "react";
import { PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js";
import {
  getAccount,
  getAssociatedTokenAddress,
  getMint,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import {
  DEVNET_PROGRAM_ID,
  getCpmmPdaAmmConfigId,
  Raydium,
  TxVersion,
} from "@raydium-io/raydium-sdk-v2";
import BN from "bn.js";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";

const DEFAULT_TEST_MINT = "429L76ZNArU3ox6LnQ2Rv3xATYTqG4M4iu7QPUpQm6Au";

function formatUnits(value: bigint, decimals: number) {
  const base = 10n ** BigInt(decimals);
  const whole = value / base;
  const fraction = (value % base).toString().padStart(decimals, "0").replace(/0+$/, "");
  return fraction ? `${whole.toString()}.${fraction}` : whole.toString();
}

function parseDecimalToUnits(value: string, decimals: number): bigint {
  if (!/^\d+(\.\d+)?$/.test(value.trim())) {
    throw new Error("Vul een geldig positief bedrag in.");
  }
  const [whole, fraction = ""] = value.trim().split(".");
  if (fraction.length > decimals) {
    throw new Error(`Gebruik maximaal ${decimals} decimalen.`);
  }
  return BigInt(whole) * 10n ** BigInt(decimals) +
    BigInt((fraction + "0".repeat(decimals)).slice(0, decimals) || "0");
}

export default function RaydiumTestPage() {
  const { connection } = useConnection();
  const wallet = useWallet();
  const [mintAddress, setMintAddress] = useState(DEFAULT_TEST_MINT);
  const [solContribution, setSolContribution] = useState("0.1");
  const [tokenDecimals, setTokenDecimals] = useState<number | null>(null);
  const [tokenSupply, setTokenSupply] = useState<bigint | null>(null);
  const [walletTokenBalance, setWalletTokenBalance] = useState<bigint | null>(null);
  const [solBalance, setSolBalance] = useState<number | null>(null);
  const [status, setStatus] = useState("Verbind je Phantom-wallet en controleer de testcoin.");
  const [busy, setBusy] = useState(false);
  const [poolId, setPoolId] = useState("");
  const [transactionId, setTransactionId] = useState("");

  const liquidityTokens = useMemo(
    () => tokenSupply === null ? null : (tokenSupply * 90n) / 100n,
    [tokenSupply],
  );
  const makerTokens = useMemo(
    () => tokenSupply === null ? null : tokenSupply - (liquidityTokens ?? 0n),
    [tokenSupply, liquidityTokens],
  );

  async function checkWalletAndToken() {
    if (!wallet.publicKey) {
      setStatus("Verbind eerst je wallet.");
      return;
    }
    setBusy(true);
    setPoolId("");
    setTransactionId("");
    try {
      const mint = new PublicKey(mintAddress.trim());
      const [mintInfo, solLamports, ata] = await Promise.all([
        getMint(connection, mint, "confirmed", TOKEN_PROGRAM_ID),
        connection.getBalance(wallet.publicKey, "confirmed"),
        getAssociatedTokenAddress(mint, wallet.publicKey, false, TOKEN_PROGRAM_ID),
      ]);
      let accountBalance = 0n;
      try {
        const tokenAccount = await getAccount(connection, ata, "confirmed", TOKEN_PROGRAM_ID);
        accountBalance = tokenAccount.amount;
      } catch {
        accountBalance = 0n;
      }
      setTokenDecimals(mintInfo.decimals);
      setTokenSupply(mintInfo.supply);
      setWalletTokenBalance(accountBalance);
      setSolBalance(solLamports / LAMPORTS_PER_SOL);
      const needed = (mintInfo.supply * 90n) / 100n;
      if (accountBalance < needed) {
        setStatus(
          `Controle klaar, maar je wallet heeft niet genoeg tokens. Nodig voor de pool: ${formatUnits(needed, mintInfo.decimals)}.`,
        );
      } else {
        setStatus("Controle geslaagd. Er is nog geen transactie verstuurd.");
      }
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Controle mislukt.");
      setTokenDecimals(null);
      setTokenSupply(null);
      setWalletTokenBalance(null);
      setSolBalance(null);
    } finally {
      setBusy(false);
    }
  }

  async function createDevnetPool() {
    if (!wallet.publicKey || !wallet.signAllTransactions) {
      setStatus("Je wallet moet verbonden zijn en transacties kunnen ondertekenen.");
      return;
    }
    if (tokenDecimals === null || tokenSupply === null || walletTokenBalance === null) {
      setStatus("Controleer eerst de wallet en testcoin.");
      return;
    }

    setBusy(true);
    setPoolId("");
    setTransactionId("");
    try {
      const mint = new PublicKey(mintAddress.trim());
      const tokenAmount = (tokenSupply * 90n) / 100n;
      const solLamports = parseDecimalToUnits(solContribution, 9);

      if (tokenAmount <= 0n) throw new Error("De berekende liquiditeitstokens zijn ongeldig.");
      if (walletTokenBalance < tokenAmount) {
        throw new Error("Je wallet heeft onvoldoende tokens voor de afgesproken 90%.");
      }
      if (solLamports <= 0n) throw new Error("De SOL-inleg moet groter zijn dan nul.");
      if (solBalance !== null && solLamports > BigInt(Math.floor(solBalance * LAMPORTS_PER_SOL))) {
        throw new Error("Je SOL-saldo is lager dan de gekozen inleg. Houd ook SOL over voor transactiekosten.");
      }

      setStatus("Raydium wordt voorbereid op Devnet. Controleer de transactie in je wallet.");
      const raydium = await Raydium.load({
        connection,
        owner: wallet.publicKey,
        signAllTransactions: wallet.signAllTransactions.bind(wallet),
        cluster: "devnet",
        disableFeatureCheck: true,
        blockhashCommitment: "finalized",
      });

      const tokenInfo = await raydium.token.getTokenInfo(mint);
      const solInfo = await raydium.token.getTokenInfo(
        new PublicKey("So11111111111111111111111111111111111111112"),
      );
      const feeConfigs = await raydium.api.getCpmmConfigs();
      const programId = DEVNET_PROGRAM_ID.CREATE_CPMM_POOL_PROGRAM;
      feeConfigs.forEach((config: { id: string; index: number }) => {
        config.id = getCpmmPdaAmmConfigId(programId, config.index).publicKey.toBase58();
      });
      const feeConfig = feeConfigs.find((config: { index: number }) => config.index === 0);
      if (!feeConfig) throw new Error("Raydium Devnet feeconfiguratie niet gevonden.");

      const { execute, extInfo } = await raydium.cpmm.createPool({
        programId,
        poolFeeAccount: DEVNET_PROGRAM_ID.CREATE_CPMM_POOL_FEE_ACC,
        mintA: tokenInfo,
        mintB: solInfo,
        mintAAmount: new BN(tokenAmount.toString()),
        mintBAmount: new BN(solLamports.toString()),
        startTime: new BN(0),
        feeConfig,
        associatedOnly: false,
        ownerInfo: {
          feePayer: wallet.publicKey,
          useSOLBalance: true,
        },
        txVersion: TxVersion.V0,
      });

      setStatus("De pooltransactie is opgebouwd. Bevestig deze alleen als Phantom de juiste Devnet-transactie toont.");
      const result = await execute({ sendAndConfirm: true });
      const createdPool = extInfo.address.poolId.toBase58();
      setPoolId(createdPool);
      setTransactionId(result.txId);
      setStatus("Raydium-pool aangemaakt op Devnet. De LP-lock en de 12-maands makerlock zijn nog aparte, verplichte vervolgstappen.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Pool aanmaken is mislukt.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#090b10] px-4 py-10 text-white">
      <div className="mx-auto max-w-3xl space-y-6">
        <header className="space-y-2">
          <p className="text-sm font-semibold tracking-[0.25em] text-[#a3ff12]">SOLANA.PUMP · DEVNET</p>
          <h1 className="text-3xl font-bold">Raydium CPMM-pooltest</h1>
          <p className="text-white/65">
            Dit scherm bouwt een echte Raydium-pooltransactie op Devnet. Er wordt niets verstuurd
            totdat jij de transactie in Phantom goedkeurt.
          </p>
        </header>

        <section className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 space-y-4">
          <WalletMultiButton />
          <div>
            <label className="mb-2 block text-sm text-white/70">Testcoin mint-adres</label>
            <input
              value={mintAddress}
              onChange={(event) => setMintAddress(event.target.value)}
              className="w-full rounded-xl border border-white/15 bg-black/30 px-3 py-3 text-sm"
              spellCheck={false}
            />
          </div>
          <div>
            <label className="mb-2 block text-sm text-white/70">SOL-inleg voor de pool</label>
            <input
              value={solContribution}
              onChange={(event) => setSolContribution(event.target.value)}
              className="w-full rounded-xl border border-white/15 bg-black/30 px-3 py-3"
              inputMode="decimal"
            />
            <p className="mt-1 text-xs text-white/45">Voorbeeld: 0.1 SOL. Houd extra SOL over voor poolkosten en transacties.</p>
          </div>
          <button
            onClick={checkWalletAndToken}
            disabled={!wallet.connected || busy}
            className="rounded-xl border border-white/20 px-4 py-3 font-semibold disabled:opacity-40"
          >
            {busy ? "Bezig..." : "Controleer wallet en testcoin"}
          </button>
        </section>

        {tokenSupply !== null && tokenDecimals !== null && (
          <section className="rounded-2xl border border-[#a3ff12]/30 bg-[#a3ff12]/[0.06] p-5 space-y-3">
            <h2 className="text-lg font-semibold">Afgesproken tokenverdeling</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl bg-black/25 p-4">
                <p className="text-sm text-white/55">90% voor liquiditeit</p>
                <p className="mt-1 text-xl font-bold text-[#a3ff12]">{formatUnits(liquidityTokens ?? 0n, tokenDecimals)}</p>
              </div>
              <div className="rounded-xl bg-black/25 p-4">
                <p className="text-sm text-white/55">10% voor maker</p>
                <p className="mt-1 text-xl font-bold">{formatUnits(makerTokens ?? 0n, tokenDecimals)}</p>
              </div>
            </div>
            <p className="text-sm text-white/55">
              In je wallet: {formatUnits(walletTokenBalance ?? 0n, tokenDecimals)} tokens.
              {solBalance !== null ? ` SOL-saldo: ${solBalance.toFixed(4)} SOL.` : ""}
            </p>
          </section>
        )}

        <section className="rounded-2xl border border-amber-400/30 bg-amber-400/[0.06] p-5 space-y-2">
          <h2 className="font-semibold text-amber-200">Belangrijk vóór goedkeuren</h2>
          <p className="text-sm text-white/75">
            Dit is uitsluitend Devnet. De gekozen 90% tokens en SOL-inleg gaan bij succesvolle
            poolaanmaak naar de pool. De beginprijs wordt bepaald door de verhouding tussen beide
            bedragen. Test eerst met kleine bedragen.
          </p>
          <p className="text-sm text-white/75">
            Deze stap vergrendelt de LP-positie nog niet en zet de resterende 10% nog niet in een
            12-maands tijdslot. Die beveiligingen moeten vóór een echte platformlancering on-chain
            worden toegevoegd en gecontroleerd.
          </p>
        </section>

        <section className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 space-y-4">
          <button
            onClick={createDevnetPool}
            disabled={!wallet.connected || busy || tokenSupply === null || walletTokenBalance === null}
            className="w-full rounded-xl bg-[#a3ff12] px-4 py-4 font-bold text-black disabled:opacity-40"
          >
            {busy ? "Bezig met voorbereiden..." : "Maak Raydium-pool aan op Devnet"}
          </button>
          <div className="rounded-xl bg-black/30 p-4 text-sm text-white/75" aria-live="polite">
            {status}
          </div>
          {poolId && (
            <div className="space-y-2 text-sm">
              <p className="font-semibold text-[#a3ff12]">Pool aangemaakt</p>
              <p className="break-all">Pool ID: {poolId}</p>
              <p className="break-all">Transactie: {transactionId}</p>
              <a
                className="inline-block text-[#a3ff12] underline"
                href={`https://explorer.solana.com/tx/${transactionId}?cluster=devnet`}
                target="_blank"
                rel="noreferrer"
              >
                Bekijk transactie op Solana Explorer
              </a>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
