package pl.mibclient.mod.fabric;

import net.minecraft.client.gui.Font;
import net.minecraft.client.gui.MibGraphics;
import net.minecraft.client.gui.screens.inventory.tooltip.ClientTooltipComponent;
import net.minecraft.core.NonNullList;
import net.minecraft.core.component.DataComponents;
import net.minecraft.core.registries.BuiltInRegistries;
import net.minecraft.world.inventory.tooltip.TooltipComponent;
import net.minecraft.world.item.ItemStack;
import net.minecraft.world.item.component.ItemContainerContents;
import pl.mibclient.mod.core.Theme;

/** Shulker tooltips: podgląd zawartości shulkera (siatka 9×3 przedmiotów) w opisie przedmiotu. */
public final class ShulkerPreview implements TooltipComponent {
	final NonNullList<ItemStack> items;

	private ShulkerPreview(NonNullList<ItemStack> items) {
		this.items = items;
	}

	/** Podgląd dla shulkera z przedmiotami albo null. */
	public static ShulkerPreview of(ItemStack stack) {
		MibClient m = MibClient.get();
		if (m == null || stack == null || !m.modules.isOn("shulker_tooltips")) return null;
		if (!BuiltInRegistries.ITEM.getKey(stack.getItem()).getPath().endsWith("shulker_box")) return null;
		ItemContainerContents c = stack.get(DataComponents.CONTAINER);
		if (c == null) return null;
		NonNullList<ItemStack> l = NonNullList.withSize(27, ItemStack.EMPTY);
		c.copyInto(l);
		boolean any = false;
		for (ItemStack s : l) any |= !s.isEmpty();
		if (!any) return null;
		MibClient.hooks.add("shulker");
		return new ShulkerPreview(l);
	}

	/** Rysowanie w dymku: 9 kolumn po 18 px, ciemne tło z ramką. */
	public static final class Client implements ClientTooltipComponent {
		private final ShulkerPreview p;

		public Client(ShulkerPreview p) {
			this.p = p;
		}

		//#if MC >= 1.21.2
		@Override
		public int getHeight(Font font) {
			return 3 * 18 + 6;
		}
		//#else
		@Override
		public int getHeight() {
			return 3 * 18 + 6;
		}
		//#endif

		@Override
		public int getWidth(Font font) {
			return 9 * 18 + 2;
		}

		//#if MC >= 26.1
		@Override
		public void extractImage(Font font, int x, int y, int w, int h, MibGraphics g) {
			draw(font, x, y, g);
		}
		//#elif MC >= 1.21.2
		@Override
		public void renderImage(Font font, int x, int y, int w, int h, MibGraphics g) {
			draw(font, x, y, g);
		}
		//#else
		@Override
		public void renderImage(Font font, int x, int y, MibGraphics g) {
			draw(font, x, y, g);
		}
		//#endif

		private void draw(Font font, int x, int y, MibGraphics g) {
			FabricCanvas c = new FabricCanvas(g, font);
			c.fill(x, y + 2, x + 9 * 18 + 2, y + 2 + 3 * 18 + 2, 0xFF24133A);
			for (int i = 0; i < 27; i++) {
				int sx = x + 1 + (i % 9) * 18, sy = y + 3 + (i / 9) * 18;
				c.fill(sx, sy, sx + 18, sy + 18, (i + i / 9) % 2 == 0 ? Theme.SLAB : Theme.SLAB2);
				c.item(p.items.get(i), sx + 1, sy + 1);
			}
			c.fill(x, y + 2, x + 9 * 18 + 2, y + 3, Theme.AM_LO);
		}
	}
}
