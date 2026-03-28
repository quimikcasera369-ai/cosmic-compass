import { motion } from "framer-motion";
import { ReactNode } from "react";

interface ConceptCardProps {
  icon: ReactNode;
  title: string;
  description: string;
  color?: "cyan" | "purple" | "gold";
}

const borderColors = {
  cyan: "border-primary/20 hover:border-primary/40",
  purple: "border-secondary/20 hover:border-secondary/40",
  gold: "border-accent/20 hover:border-accent/40",
};

const ConceptCard = ({ icon, title, description, color = "cyan" }: ConceptCardProps) => {
  return (
    <motion.div
      whileHover={{ y: -4 }}
      className={`rounded-xl border bg-card/30 backdrop-blur-sm p-6 transition-all ${borderColors[color]}`}
    >
      <div className="mb-4 text-2xl">{icon}</div>
      <h4 className="font-semibold mb-2 text-foreground">{title}</h4>
      <p className="text-sm text-muted-foreground leading-relaxed">{description}</p>
    </motion.div>
  );
};

export default ConceptCard;
