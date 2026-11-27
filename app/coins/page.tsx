import SiteHeader from "../components/SiteHeader";
import CoinMarket from "./CoinMarket";

export const dynamic = "force-dynamic";

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
    console.error("Supabase-instellingen ontbreken.");
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
    <>
      <SiteHeader />
      <CoinMarket coins={coins} />
    </>
  );
}
