package pl.mibclient.mod.fabric;

import net.minecraft.resources.MibId;

/** Dane MiB w stanie rysowania postaci: „to własna postać” (emotki, ukrywanie elytry), skrzydła i czapka gracza MiB. */
public interface MibSelfState {
	boolean mib$self();

	void mib$self(boolean self);

	/** Skrzydła MiB (tekstura w skórce jako elytra): gra rysuje je jak elytrę, także bez elytry na sobie. */
	boolean mib$wings();

	void mib$wings(boolean wings);

	/** Tekstura czapki MiB albo null. */
	MibId mib$hat();

	void mib$hat(MibId hat);
}
