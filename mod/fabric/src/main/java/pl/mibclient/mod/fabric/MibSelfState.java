package pl.mibclient.mod.fabric;

/** Znacznik „to własna postać” w stanie rysowania postaci (emotki, ukrywanie elytry). */
public interface MibSelfState {
	boolean mib$self();

	void mib$self(boolean self);
}
