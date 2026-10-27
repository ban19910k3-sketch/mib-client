package pl.mibclient.mod.fabric;

import net.minecraft.resources.MibId;

/** Dane MiB w stanie rysowania postaci: „to własna postać” (emotki, ukrywanie elytry), skrzydła, czapka i aura gracza MiB. */
public interface MibSelfState {
	boolean mib$self();

	void mib$self(boolean self);

	/** Skrzydła MiB (tekstura w skórce jako elytra): gra rysuje je jak elytrę, także bez elytry na sobie. */
	boolean mib$wings();

	void mib$wings(boolean wings);

	/** Tekstura czapki MiB albo null. */
	MibId mib$hat();

	void mib$hat(MibId hat);

	/** Tekstura maski MiB (od 0.25.0, pod czapką) albo null. */
	MibId mib$mask();

	void mib$mask(MibId mask);

	/** Tekstura skrzydeł MiB jak u wróżki (FairyWingsLayer) albo null. */
	MibId mib$fairy();

	void mib$fairy(MibId fairy);

	/** Aura MiB (AuraLayer): tekstura z obrazkami cząsteczek albo null, ruch (Auras) i numer gracza do losowania cząsteczek. */
	MibId mib$aura();

	int mib$auraStyle();

	int mib$auraSeed();

	void mib$aura(MibId aura, int style, int seed);
}
