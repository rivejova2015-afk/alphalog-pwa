import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { FlashcardDeck } from "@/components/securities/cybersec/FlashcardDeck.client";
import { FLASHCARDS, FLASHCARD_CATEGORIES } from "@/lib/securities/cybersec";

export default async function FlashcardsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth");

  return (
    <div className="max-w-2xl mx-auto py-6 px-4">
      <FlashcardDeck cards={FLASHCARDS} categories={FLASHCARD_CATEGORIES} />
    </div>
  );
}
