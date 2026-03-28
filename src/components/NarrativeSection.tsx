import { motion } from "framer-motion";
import { ReactNode } from "react";

interface NarrativeSectionProps {
  id: string;
  badge: string;
  badgeColor?: "cyan" | "purple" | "gold";
  title: ReactNode;
  description: string;
  children?: ReactNode;
}

const badgeStyles = {
  cyan: "border-primary/30 text-primary",
  purple: "border-secondary/30 text-secondary",
  gold: "border-accent/30 text-accent",
};

const NarrativeSection = ({ id, badge, badgeColor = "cyan", title, description, children }: NarrativeSectionProps) => {
  return (
    <section id={id} className="relative py-24 md:py-32 px-6">
      <div className="max-w-5xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.8 }}
          className="mb-12"
        >
          <span className={`inline-block text-xs tracking-[0.25em] uppercase border px-3 py-1 rounded-full mb-6 ${badgeStyles[badgeColor]}`}>
            {badge}
          </span>
          <h2 className="text-3xl md:text-5xl font-bold mb-6 leading-tight">
            {title}
          </h2>
          <p className="text-lg text-muted-foreground max-w-3xl leading-relaxed">
            {description}
          </p>
        </motion.div>

        {children && (
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-50px" }}
            transition={{ duration: 0.8, delay: 0.2 }}
          >
            {children}
          </motion.div>
        )}
      </div>
    </section>
  );
};

export default NarrativeSection;
