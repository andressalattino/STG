export type Trip = {
  source?: "local" | "supabase";
  id: string;
  title: string;
  description: string;
  imageUrl: string;
  pdfUrl: string;
  featured?: boolean;
};

export type Comment = {
  id?: string;
  source?: "local" | "supabase";
  name: string;
  trip: string;
  text: string;
};

export type PassengerPhoto = {
  source?: "local" | "supabase";
  id: string;
  title: string;
  description: string;
  imageUrl: string;
};
