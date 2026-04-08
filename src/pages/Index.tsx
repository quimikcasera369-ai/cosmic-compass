import StarField from "@/components/StarField";
import HeroSection from "@/components/HeroSection";
import NarrativeSection from "@/components/NarrativeSection";
import GalaxySimulator from "@/components/GalaxySimulator";
import AccelerationExplorer from "@/components/AccelerationExplorer";
import CriticalAcceleration from "@/components/CriticalAcceleration";
import PredictionsExplorer from "@/components/PredictionsExplorer";
import UniverseGeometry from "@/components/UniverseGeometry";
import ConceptCard from "@/components/ConceptCard";
import { motion } from "framer-motion";
import { Orbit, Waves, Globe2, Sparkles, FlaskConical, Telescope, FlaskRound } from "lucide-react";
import GalaxyDataLab from "@/components/GalaxyDataLab";
import UniverseLab from "@/components/UniverseLab/UniverseLab";

const Index = () => {
  return (
    <div className="relative min-h-screen bg-background overflow-x-hidden">
      <StarField />

      <div className="relative z-10">
        <HeroSection />

        {/* 1. The Problem */}
        <NarrativeSection
          id="problem"
          badge="The Mystery"
          badgeColor="gold"
          title={
            <>
              <span className="text-foreground">Stars at the edge of galaxies </span>
              <span className="gradient-text-gold">move too fast</span>
            </>
          }
          description="Since the 1970s, astronomers have observed that stars in the outer regions of galaxies orbit far faster than Newtonian gravity predicts. The standard fix? Invent invisible 'dark matter' filling the halo. But what if the answer lies deeper — in the fabric of spacetime itself?"
        >
          <div className="grid md:grid-cols-3 gap-4">
            <ConceptCard
              icon={<Orbit className="w-6 h-6 text-accent" />}
              title="Flat Rotation Curves"
              description="Instead of slowing down, orbital velocities stay constant at large radii — defying Newtonian expectations."
              color="gold"
            />
            <ConceptCard
              icon={<Sparkles className="w-6 h-6 text-primary" />}
              title="The Dark Matter Hypothesis"
              description="To explain this, physicists proposed unseen mass. Decades later, no dark matter particle has been detected."
              color="cyan"
            />
            <ConceptCard
              icon={<Waves className="w-6 h-6 text-secondary" />}
              title="A Deeper Pattern"
              description="The Baryonic Tully-Fisher Relation shows V⁴ ∝ M — a strikingly simple law hiding beneath the anomaly."
              color="purple"
            />
          </div>
        </NarrativeSection>

        {/* 2. The Galaxy Simulator */}
        <NarrativeSection
          id="simulator"
          badge="Explore"
          badgeColor="cyan"
          title={
            <>
              <span className="text-foreground">See the </span>
              <span className="gradient-text-cyan">difference</span>
              <span className="text-foreground"> yourself</span>
            </>
          }
          description="Adjust the galaxy mass and toggle between Newtonian and emergent gravity. Watch how the rotation curve changes — the emergent model naturally produces flat curves."
        >
          <GalaxySimulator />
        </NarrativeSection>

        {/* 3. The New Idea */}
        <NarrativeSection
          id="emergence"
          badge="The Insight"
          badgeColor="purple"
          title={
            <>
              <span className="text-foreground">Gravity </span>
              <span className="gradient-text-purple">emerges</span>
              <span className="text-foreground"> from cosmic geometry</span>
            </>
          }
          description="Instead of adding invisible matter, this hypothesis proposes that at very low accelerations, the closed geometry of our universe (a 3-sphere) creates an additional gravitational effect — gravity emerges from the coherence of De Sitter spacetime."
        >
          <div className="grid md:grid-cols-3 gap-4">
            <ConceptCard
              icon={<Globe2 className="w-6 h-6 text-secondary" />}
              title="Closed Universe"
              description="If the universe is a 3-sphere (like the surface of a 4D ball), its curvature affects gravity at large scales."
              color="purple"
            />
            <ConceptCard
              icon={<Waves className="w-6 h-6 text-primary" />}
              title="De Sitter Coherence"
              description="Quantum vacuum fluctuations in an expanding universe create a coherent gravitational background — like ripples reinforcing in a finite pond."
              color="cyan"
            />
            <ConceptCard
              icon={<FlaskConical className="w-6 h-6 text-accent" />}
              title="No Free Parameters"
              description="The critical acceleration is derived entirely from known constants — no fitting, no adjustable knobs."
              color="gold"
            />
          </div>
        </NarrativeSection>

        {/* Universe Geometry */}
        <NarrativeSection
          id="geometry"
          badge="Geometry"
          badgeColor="purple"
          title={
            <>
              <span className="text-foreground">Flat vs </span>
              <span className="gradient-text-purple">closed</span>
              <span className="text-foreground"> universe</span>
            </>
          }
          description="The shape of the universe changes everything. In a closed 3-sphere, vacuum fluctuations can't escape — they create coherent gravitational effects that emerge as the extra gravity we observe."
        >
          <UniverseGeometry />
        </NarrativeSection>

        {/* 4. Acceleration Explorer */}
        <NarrativeSection
          id="regimes"
          badge="Two Regimes"
          badgeColor="cyan"
          title={
            <>
              <span className="text-foreground">A </span>
              <span className="gradient-text-cyan">critical threshold</span>
              <span className="text-foreground"> splits two worlds</span>
            </>
          }
          description="Above the critical acceleration, familiar Newtonian gravity rules. Below it, the emergent regime takes over with its distinctive V⁴ = GM·g_crit scaling."
        >
          <AccelerationExplorer />
        </NarrativeSection>

        {/* 5. Critical Acceleration */}
        <NarrativeSection
          id="critical"
          badge="The Scale"
          badgeColor="gold"
          title={
            <>
              <span className="text-foreground">One number </span>
              <span className="gradient-text-gold">from the cosmos</span>
            </>
          }
          description="The critical acceleration isn't chosen — it's calculated from the speed of light, the expansion rate of the universe, and the geometry of three dimensions."
        >
          <CriticalAcceleration />
        </NarrativeSection>

        {/* 6. Predictions */}
        <NarrativeSection
          id="predictions"
          badge="Testable"
          badgeColor="cyan"
          title={
            <>
              <span className="gradient-text-cyan">Predictions</span>
              <span className="text-foreground"> that can be checked</span>
            </>
          }
          description="A theory without predictions is just a story. This model predicts that the Baryonic Tully-Fisher Relation should evolve with redshift — galaxies at z=2 should show a +0.120 dex shift. Upcoming surveys can test this."
        >
          <PredictionsExplorer />
        </NarrativeSection>

        {/* Galaxy Data Lab */}
        <NarrativeSection
          id="datalab"
          badge="Data Lab"
          badgeColor="gold"
          title={
            <>
              <span className="text-foreground">Galaxy </span>
              <span className="gradient-text-gold">Data Lab</span>
            </>
          }
          description="Test V⁴ ∝ M·H(z) with real data. Upload galaxy observations or use the sample dataset to compute α = a_obs / (c·H(z)) and classify each galaxy's gravitational regime."
        >
          <GalaxyDataLab />
        </NarrativeSection>

        {/* Universe Lab */}
        <NarrativeSection
          id="universelab"
          badge="Universe Lab"
          badgeColor="cyan"
          title={
            <>
              <span className="text-foreground">Universe </span>
              <span className="gradient-text-cyan">Laboratory</span>
            </>
          }
          description="A physics sandbox where random particles evolve under Newtonian gravity + K-field dynamics. Watch structures emerge and let the system automatically detect rotation laws, clustering, and field-mass memory effects."
        >
          <UniverseLab />
        </NarrativeSection>

        {/* 7. Summary */}
        <section className="py-24 md:py-32 px-6">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
            className="max-w-3xl mx-auto text-center"
          >
            <Telescope className="w-10 h-10 text-primary mx-auto mb-6" />
            <h2 className="text-3xl md:text-4xl font-bold mb-6">
              <span className="text-foreground">The universe may be </span>
              <span className="gradient-text-cyan">simpler</span>
              <span className="text-foreground"> than we thought</span>
            </h2>
            <p className="text-muted-foreground leading-relaxed mb-8">
              No invisible particles. No free parameters. Just the geometry of spacetime, the expansion of the universe, and the speed of light — conspiring to produce the gravity we observe.
            </p>
            <div className="inline-flex items-center gap-2 text-xs tracking-[0.2em] uppercase text-muted-foreground border border-border rounded-full px-4 py-2">
              <span className="w-2 h-2 rounded-full bg-primary animate-pulse-glow" />
              Emergent Gravity from De Sitter Coherence
            </div>
          </motion.div>
        </section>

        {/* Footer */}
        <footer className="border-t border-border py-8 px-6 text-center text-xs text-muted-foreground space-y-1">
          <p>An interactive exploration of emergent gravity · Built for curiosity</p>
          <p className="gradient-text-cyan">By Juan Pablo Figueroa Torres</p>
        </footer>
      </div>
    </div>
  );
};

export default Index;
