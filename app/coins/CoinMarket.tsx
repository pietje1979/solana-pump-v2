"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

type Coin = {
  id: number;
  mint_address: string;
  name: string;
  ticker: string;
  description: string | null;
  image_url: string | null;
  created_at: string;
};

function formatSupply(raw: string, decimals: number): string {
  const amount = BigInt(raw);
  const divisor = 10n ** BigInt(decimals);
  const whole = amount / divisor;
  const fraction = (amount % divisor)
    .toString()
    .padStart(decimals, "0")
    .replace(/0+$/, "");

  const formattedWhole = new Intl.NumberFormat("nl-NL", {
    maximumFractionDigits: 0,
  }).format(whole);

  return fraction ? `${formattedWhole},${fraction}` : formattedWhole;
}

export default function CoinMarket({ coins }: { coins: Coin[] }) {
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("newest");
  const [now, setNow] = useState(0);
  const [supplies, setSupplies] = useState<Record<string, string>>({});

  useEffect(() => {
    setNow(Date.now());
    const timer = window.setInterval(() => setNow(Date.now()), 60000);
    return () => window.clearInterval(timer);
  }, []);

  function coinAge(createdAt: string) {
    if (!now) return "Leeftijd berekenen...";
    const minutes = Math.max(0, Math.floor((now - new Date(createdAt).getTime()) / 60000));
    if (minutes < 1) return "Zojuist aangemaakt";
    if (minutes < 60) return `${minutes} minuten oud`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} uur oud`;
    const days = Math.floor(hours / 24);
    if (days < 30) return `${days} dagen oud`;
    const months = Math.floor(days / 30);
    if (months < 12) return `${months} maanden oud`;
    return `${Math.floor(days / 365)} jaar oud`;
  }

  useEffect(() => {
    let cancelled = false;

    async function loadSupplies() {
      const results = await Promise.all(
        coins.map(async (coin) => {
          try {
            const response = await fetch(
              `/api/token-supply?mint=${encodeURIComponent(coin.mint_address)}`
            );

            if (!response.ok) {
              return [coin.mint_address, "Niet beschikbaar"] as const;
            }

            const data = await response.json();
            return [
              coin.mint_address,
              formatSupply(data.supply, data.decimals),
            ] as const;
          } catch {
            return [coin.mint_address, "Niet beschikbaar"] as const;
          }
        })
      );

      if (!cancelled) {
        setSupplies(Object.fromEntries(results));
      }
    }

    loadSupplies();

    return () => {
      cancelled = true;
    };
  }, [coins]);

  const filteredCoins = useMemo(() => {
    const term = search.trim().toLowerCase();

    const result = coins.filter((coin) =>
      `${coin.name} ${coin.ticker} ${coin.description || ""}`
        .toLowerCase()
        .includes(term)
    );

    return result.sort((a, b) => {
      if (sort === "name") {
        return a.name.localeCompare(b.name);
      }

      return (
        new Date(b.created_at).getTime() -
        new Date(a.created_at).getTime()
      );
    });
  }, [coins, search, sort]);

  return (
    <main className="min-h-screen bg-[#090b10] px-5 py-10 text-white">
      <div className="mx-auto max-w-6xl">
        <Link href="/" className="text-sm text-[#a3ff12] hover:underline">
          ← Terug naar SOLANA.PUMP
        </Link>

        <section className="mb-10 mt-8">
          <p className="mb-3 text-sm font-bold uppercase tracking-widest text-[#a3ff12]">
            Community tokens
          </p>

          <h1 className="text-4xl font-black sm:text-5xl">
            Ontdek de markt
          </h1>

          <p className="mt-4 max-w-2xl text-gray-400">
            Ontdek nieuwe projecten, bekijk hun verhaal en vind de volgende
            community om te volgen.
          </p>

          <div className="mt-5 inline-flex rounded-full border border-[#a3ff12]/30 bg-[#a3ff12]/10 px-4 py-2 text-xs font-bold text-[#a3ff12]">
            SOLANA DEVNET · TESTNET
          </div>
        </section>

        <section className="mb-8 rounded-2xl border border-white/10 bg-[#11151d] p-5">
          <div className="grid gap-4 sm:grid-cols-[1fr_220px]">
            <div>
              <label htmlFor="coin-search" className="mb-2 block text-sm font-semibold text-gray-300">
                Zoek een coin
              </label>
              <input
                id="coin-search"
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Zoek op naam, ticker of beschrijving..."
                className="w-full rounded-xl border border-white/10 bg-[#090b10] px-4 py-3 text-white outline-none transition focus:border-[#a3ff12]"
              />
            </div>

            <div>
              <label htmlFor="coin-sort" className="mb-2 block text-sm font-semibold text-gray-300">
                Sorteren op
              </label>
              <select
                id="coin-sort"
                value={sort}
                onChange={(event) => setSort(event.target.value)}
                className="w-full rounded-xl border border-white/10 bg-[#090b10] px-4 py-3 text-white outline-none focus:border-[#a3ff12]"
              >
                <option value="newest">Nieuwste eerst</option>
                <option value="name">Naam A tot Z</option>
              </select>
            </div>
          </div>

          <p className="mt-4 text-sm text-gray-400">
            {filteredCoins.length} {filteredCoins.length === 1 ? "coin gevonden" : "coins gevonden"}
          </p>
        </section>

        {filteredCoins.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-[#11151d] p-10 text-center">
            <div className="mb-4 text-4xl">🔎</div>
            <h2 className="text-xl font-bold">
              {coins.length === 0
                ? "Nog geen coins gevonden"
                : "Geen resultaten gevonden"}
            </h2>
            <p className="mt-3 text-gray-400">
              {coins.length === 0
                ? "Zodra coins succesvol worden geregistreerd, verschijnen ze hier."
                : "Probeer een andere zoekterm."}
            </p>
            {coins.length === 0 && (
              <Link
                href="/"
                className="mt-6 inline-block rounded-xl bg-[#a3ff12] px-6 py-3 font-bold text-black"
              >
                Naar coin launch
              </Link>
            )}
          </div>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {filteredCoins.map((coin) => (
              <article
                key={coin.id}
                className="group flex flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#11151d] p-5 transition duration-200 hover:-translate-y-1 hover:border-[#a3ff12]/50 hover:bg-[#151b25]"
              >
                <div className="mb-5 flex items-center gap-4">
                  {coin.image_url ? (
                    <img
                      src={coin.image_url}
                      alt={`${coin.name} logo`}
                      className="h-16 w-16 rounded-2xl border border-white/10 object-cover"
                    />
                  ) : (
                    <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[#202733] text-2xl font-black text-[#a3ff12]">
                      {coin.ticker.slice(0, 1).toUpperCase()}
                    </div>
                  )}

                  <div className="min-w-0">
                    <h2 className="truncate text-xl font-black">
                      {coin.name}
                    </h2>
                    <p className="mt-1 font-bold text-[#a3ff12]">
                      ${coin.ticker}
                    </p>
                  </div>
                </div>

                <p className="mb-5 min-h-16 text-sm leading-6 text-gray-400">
                  {coin.description || "Geen beschrijving beschikbaar."}
                </p>

                <div className="mt-auto">
                  <div className="mb-4 flex items-center justify-between text-xs text-gray-500">
                    <span>Solana Devnet</span>
                    <span>
{coinAge(coin.created_at)}
                    </span>
                  </div>

                  <p className="mb-3 text-sm font-semibold text-gray-300">
                    Totale voorraad:{" "}
                    <span className="text-[#a3ff12]">
                      {supplies[coin.mint_address] ?? "Ophalen..."} {coin.ticker}
                    </span>
                  </p>

                  <p className="mb-4 break-all text-xs text-gray-500">
                    Mint: {coin.mint_address}
                  </p>

                  <Link
                    href={`/coin/${coin.mint_address}`}
                    className="block rounded-xl bg-[#a3ff12] px-5 py-3 text-center font-bold text-black transition hover:bg-[#b7ff4d]"
                  >
                    Bekijk coin →
                  </Link>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
