import { motion } from "framer-motion";

const pieces = [
  {
    symbol: "c",
    label: "Speed of light",
    desc: "The universal speed limit",
    color: "gradient-text-cyan",
  },
  {
    symbol: "H₀",
    label: "Hubble constant",
    desc: "The expansion rate of the universe",
    color: "gradient-text-gold",
  },
  {
    symbol: "4π²",
    label: "Spherical geometry",
    desc: "Surface of a 3-sphere (S³)",
    color: "gradient-text-purple",
  },
  {
    symbol: "√3",
    label: "Dimensionality",
    desc: "Three spatial dimensions",
    color: "gradient-text-cyan",
  },
];

const CriticalAcceleration = () => {
  return (
    <div className="space-y-8">
      {/* Main equation card */}
      <motion.div
        className="rounded-xl border border-border bg-card/50 backdrop-blur-sm p-8 text-center glow-border-cyan"
        whileInView={{ scale: [0.95, 1] }}
        viewport={{ once: true }}
        transition={{ duration: 0.6 }}
      >
        <p className="text-xs tracking-[0.3em] uppercase text-muted-foreground mb-4">
          The critical acceleration
        </p>
        <div className="text-3xl md:text-5xl font-bold mb-2 font-mono">
          <span className="gradient-text-gold">g</span>
          <sub className="text-lg text-muted-foreground">crit</sub>
          <span className="text-muted-foreground mx-3">=</span>
          <span className="text-foreground">
            <span className="gradient-text-cyan">c</span>
            <span className="gradient-text-gold">H₀</span>
          </span>
          <span className="text-muted-foreground mx-1">/</span>
          <span className="gradient-text-purple">4π²√3</span>
        </div>
        <p className="text-lg font-mono text-primary mt-4">
          ≈ 9.58 × 10⁻¹² m/s²
        </p>
        <p className="text-sm text-muted-foreground mt-2">
          No free parameters — derived entirely from cosmological constants
        </p>
      </motion.div>

      {/* Intuitive pieces */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {pieces.map((piece, i) => (
          <motion.div
            key={piece.symbol}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.1, duration: 0.5 }}
            className="rounded-lg border border-border bg-card/30 p-4 text-center hover:bg-card/60 transition-colors"
          >
            <div className={`text-2xl font-bold font-mono mb-2 ${piece.color}`}>
              {piece.symbol}
            </div>
            <div className="text-sm font-medium text-foreground mb-1">{piece.label}</div>
            <div className="text-xs text-muted-foreground">{piece.desc}</div>
          </motion.div>
        ))}
      </div>

      <p className="text-sm text-muted-foreground text-center max-w-xl mx-auto">
        Each piece connects to a fundamental property of our universe — together they predict the exact scale where gravity transitions from familiar to emergent.
      </p>
    </div>
  );
};

export default CriticalAcceleration;
