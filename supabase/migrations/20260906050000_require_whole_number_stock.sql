-- New stock, thresholds and sale quantities must use whole units. Keep the
-- constraints unvalidated so legacy fractional rows remain visible and can be
-- corrected deliberately instead of being rounded during deployment.

alter table public.products
  add constraint products_reorder_level_whole
  check (reorder_level = trunc(reorder_level)) not valid;

alter table public.product_variants
  add constraint product_variants_stock_whole
  check (stock_quantity = trunc(stock_quantity)) not valid,
  add constraint product_variants_low_stock_whole
  check (low_stock_threshold = trunc(low_stock_threshold)) not valid;

alter table public.inventory_levels
  add constraint inventory_levels_on_hand_whole
  check (quantity_on_hand = trunc(quantity_on_hand)) not valid,
  add constraint inventory_levels_reserved_whole
  check (quantity_reserved = trunc(quantity_reserved)) not valid;

alter table public.order_items
  add constraint order_items_quantity_whole
  check (quantity = trunc(quantity)) not valid;

alter table public.sale_items
  add constraint sale_items_quantity_whole
  check (quantity = trunc(quantity)) not valid;

notify pgrst, 'reload schema';
