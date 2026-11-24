
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

async function getCoins(): Promise<Coin[]> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !key) {
    return [];
  }

  try {
    const response = await fetch(
      `${url}/rest/v1/coins?select=id,mint_address,name,ticker,description,image_url,created_at&network=eq.devnet&order=created_at.desc`,
      {
        headers: {
          apikey: key,
          Authorization: `Bearer ${key}`,
        },
        cache: "no-store",
      }
    );

    if (!response.ok) {
      console.error("Coins ophalen mislukt:", await response.text());
      return [];
    }

    return await response.json();
  } catch (error) {
    console.error("Databasefout:", error);
    return [];
  }
}

export default async function CoinsPage() {
  const coins = await getCoins();

  return (
    <main className="min-h-screen bg-[#090b10] px-5 py-10 text-white">
      <div className="mx-auto max-w-6xl">
        <Link
          href="/"
          className="text-sm text-[#a3ff12] hover:underline"
        >
          ← Terug naar SOLANA.PUMP
        </Link>

        <div className="mb-10 mt-8">
          <p className="mb-3 text-sm font-bold uppercase tracking-widest text-[#a3ff12]">
            Community tokens
          </p>
          <h1 className="text-4xl font-black">
            Explore coins
          </h1>
          <p className="mt-3 text-gray-400">
            Ontdek alle memecoins die op SOLANA.PUMP zijn aangemaakt.
          </p>
        </div>

        {coins.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-[#11151d] p-8">
            <h2 className="text-xl font-bold">
              Nog geen coins gevonden
            </h2>
            <p className="mt-2 text-gray-400">
              Zodra er coins succesvol worden geregistreerd, verschijnen ze hier.
            </p>
            <Link
              href="/"
              className="mt-6 inline-block rounded-xl bg-[#a3ff12] px-6 py-3 font-bold text-black"
            >
              Maak een coin aan
            </Link>
          </div>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {coins.map((coin) => (
              <article
                key={coin.id}
                className="overflow-hidden rounded-2xl border border-white/10 bg-[#11151d] p-5"
              >
                {coin.image_url ? (
                  <img
                    src={coin.image_url}
                    alt={`${coin.name} logo`}
                    className="mb-5 h-20 w-20 rounded-2xl object-cover"
                  />
                ) : (
                  <div className="mb-5 flex h-20 w-20 items-center justify-center rounded-2xl bg-[#202733] text-3xl font-black text-[#a3ff12]">
                    {coin.ticker.slice(0, 1)}
                  </div>
                )}

                <h2 className="text-xl font-black">
                  {coin.name}
                </h2>

                <p className="mt-1 font-bold text-[#a3ff12]">
                  ${coin.ticker}
                </p>

                <p className="mt-4 min-h-16 text-sm leading-6 text-gray-400">
                  {coin.description || "Geen beschrijving beschikbaar."}
                </p>

                <p className="mt-4 break-all text-xs text-gray-500">
                  Mint: {coin.mint_address}
                </p>

                <Link
                  href={`/coin/${coin.mint_address}`}
                  className="mt-5 block rounded-xl bg-[#a3ff12] px-5 py-3 text-center font-bold text-black"
                >
                  Bekijk coin
                </Link>
              </article>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
