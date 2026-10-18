package pl.mibclient.mod.fabric;

/** Dane MiB doklejone do stanu rysowania leżącego przedmiotu (od 1.21.2 rysowanie nie ma już dostępu do przedmiotu). */
public interface MibItemState {
	/** {skala UHC overlay, płasko (1/0), kolor promienia ARGB albo 0}. */
	float[] mib$item();

	void mib$item(float[] v);
}
