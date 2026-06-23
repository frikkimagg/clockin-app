import { NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase-server";

export async function GET() {
  try {
    const supabase = getSupabaseServer();
    const { data, error } = await supabase
      .from("companies")
      .select("id, name")
      .order("name");

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ companies: data });
  } catch (err) {
    console.error("Companies error:", err);
    return NextResponse.json(
      { error: "Couldn't load companies. Try again." },
      { status: 500 }
    );
  }
}
