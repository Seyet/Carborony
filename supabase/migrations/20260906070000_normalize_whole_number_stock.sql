-- Normalize legacy operational stock values so constrained rows remain editable.
-- Historical order and sale quantities are left unchanged; their NOT VALID
-- constraints still require every new or updated quantity to be a whole number.

update public.products
set reorder_level = round(reorder_level)
where reorder_level <> round(reorder_level);

update public.product_variants
set stock_quantity = round(stock_quantity),
  low_stock_threshold = round(low_stock_threshold)
where stock_quantity <> round(stock_quantity)
  or low_stock_threshold <> round(low_stock_threshold);

update public.inventory_levels
set quantity_on_hand = round(quantity_on_hand),
  quantity_reserved = round(quantity_reserved)
where quantity_on_hand <> round(quantity_on_hand)
  or quantity_reserved <> round(quantity_reserved);

alter table public.products
  validate constraint products_reorder_level_whole;

alter table public.product_variants
  validate constraint product_variants_stock_whole,
  validate constraint product_variants_low_stock_whole;

alter table public.inventory_levels
  validate constraint inventory_levels_on_hand_whole,
  validate constraint inventory_levels_reserved_whole;

notify pgrst, 'reload schema';
