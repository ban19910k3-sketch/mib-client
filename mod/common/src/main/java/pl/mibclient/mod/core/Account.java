package pl.mibclient.mod.core;

/** Konto Microsoft z launchera (bez tokenów: tylko id, nick i czy jest aktywne). */
public final class Account {
	public final String id, name;
	public final boolean active;

	public Account(String id, String name, boolean active) {
		this.id = id;
		this.name = name;
		this.active = active;
	}
}
