export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

type DomainTable<
  Row,
  RequiredInsert extends keyof Row,
  Generated extends keyof Row = never,
> = {
  Row: Row
  Insert: Pick<Row, RequiredInsert> &
    Partial<Omit<Row, RequiredInsert | Generated>> &
    { [Key in Generated]?: never }
  Update: Partial<Omit<Row, Generated>> & { [Key in Generated]?: never }
  Relationships: []
}

type CategoryRow = {
  business_id: string
  created_at: string
  created_by: string
  description: string | null
  id: string
  is_active: boolean
  name: string
  parent_id: string | null
  position: number
  slug: string
  updated_at: string
}

type ActivityLogRow = {
  action: string
  actor_name: string
  actor_user_id: string | null
  business_id: string
  created_at: string
  entity_id: string | null
  entity_name: string | null
  entity_type: string
  id: string
  new_value: Json | null
  previous_value: Json | null
}

type BusinessBillingProfileRow = {
  billing_email: string | null
  billing_interval: string | null
  business_id: string
  cancel_at_period_end: boolean
  created_at: string
  currency_code: string
  current_period_ends_at: string | null
  current_period_starts_at: string | null
  payment_method_brand: string | null
  payment_method_expiry_month: number | null
  payment_method_expiry_year: number | null
  payment_method_last_four: string | null
  plan_amount: number
  plan_code: string
  subscription_status: string
  updated_at: string
}

type BillingInvoiceRow = {
  amount_due: number
  amount_paid: number
  business_id: string
  created_at: string
  currency_code: string
  due_at: string | null
  hosted_invoice_url: string | null
  id: string
  invoice_number: string
  issued_at: string
  paid_at: string | null
  status: string
}

type CustomerRow = {
  address: string | null
  birthday: string | null
  business_id: string
  created_at: string
  created_by: string
  email: string | null
  full_name: string
  id: string
  notes: string | null
  phone: string | null
  segment: string
  source: string
  tags: string[]
  updated_at: string
}

type ExpenseCategoryRow = {
  business_id: string
  created_at: string
  created_by: string
  id: string
  is_active: boolean
  name: string
  updated_at: string
}

type ExpenseRow = {
  amount: number
  attachment_file_name: string | null
  attachment_file_size: number | null
  attachment_mime_type: string | null
  attachment_storage_path: string | null
  business_id: string
  category_id: string
  created_at: string
  created_by: string
  currency_code: string
  description: string | null
  id: string
  incurred_at: string
  name: string
  payment_method: string
  reference: string | null
  staff_member_id: string | null
  status: string
  updated_at: string
}

type InventoryLevelRow = {
  business_id: string
  created_at: string
  id: string
  location_id: string
  product_id: string
  quantity_on_hand: number
  quantity_reserved: number
  updated_at: string
}

type InventoryLocationRow = {
  business_id: string
  code: string
  created_at: string
  created_by: string
  id: string
  is_active: boolean
  is_default: boolean
  name: string
  updated_at: string
}

type InventoryMovementRow = {
  business_id: string
  created_at: string
  created_by: string
  id: string
  location_id: string
  movement_type: string
  note: string | null
  occurred_at: string
  product_id: string
  quantity_delta: number
  reference_id: string | null
  reference_type: string | null
  unit_cost: number | null
  variant_id: string | null
}

type OrderItemRow = {
  business_id: string
  created_at: string
  discount_amount: number
  id: string
  item_source: string
  line_total: number
  order_id: string
  product_id: string | null
  product_name: string
  quantity: number
  sku: string | null
  unit_price: number
  updated_at: string
  variant_id: string | null
  variant_name: string | null
}

type OrderRow = {
  buyer_email: string | null
  business_id: string
  buyer_name: string | null
  buyer_phone: string | null
  channel: string
  completed_at: string | null
  created_at: string
  created_by: string | null
  currency_code: string
  customer_id: string | null
  delivery_address: string | null
  delivery_zone_id: string | null
  delivery_zone_name: string | null
  discount_amount: number
  document_type: string
  fulfillment_status: string
  id: string
  notes: string | null
  order_number: string
  payment_method: string | null
  payment_status: string
  placed_at: string
  shipping_amount: number
  status: string
  subtotal_amount: number
  tax_amount: number
  total_amount: number
  updated_at: string
}

type OrderStatusHistoryRow = {
  business_id: string
  changed_by: string | null
  created_at: string
  id: string
  new_status: string
  note: string | null
  order_id: string
  previous_status: string | null
}

type ProductRow = {
  business_id: string
  category_id: string | null
  cost_price: number
  created_at: string
  created_by: string
  description: string | null
  discount_price: number | null
  id: string
  name: string
  reorder_level: number
  selling_price: number
  sku: string | null
  specifications: Json
  status: string
  tags: string[]
  track_inventory: boolean
  updated_at: string
}

type ProductVariantRow = {
  attributes: Json
  business_id: string
  cost_price: number
  created_at: string
  created_by: string
  id: string
  is_active: boolean
  low_stock_threshold: number
  name: string
  product_id: string
  selling_price: number
  sku: string | null
  stock_quantity: number
  updated_at: string
}

type ProductMediaRow = {
  business_id: string
  created_at: string
  created_by: string
  file_name: string
  file_size: number
  id: string
  is_primary: boolean
  media_kind: string
  mime_type: string
  position: number
  product_id: string
  storage_path: string
  updated_at: string
  variant_id: string | null
}

type SaleItemRow = {
  business_id: string
  created_at: string
  discount_amount: number
  id: string
  item_source: string
  line_total: number
  product_id: string | null
  product_name: string
  quantity: number
  sale_id: string
  sku: string | null
  unit_cost: number
  unit_price: number
  variant_id: string | null
  variant_name: string | null
}

type SaleRow = {
  business_id: string
  buyer_name: string | null
  buyer_phone: string | null
  channel: string
  created_at: string
  created_by: string
  currency_code: string
  customer_id: string | null
  discount_amount: number
  id: string
  order_id: string | null
  payment_method: string
  sale_number: string
  sold_at: string
  status: string
  subtotal_amount: number
  tax_amount: number
  total_amount: number
  updated_at: string
}

type StorefrontRow = {
  announcement: string | null
  bank_transfer_enabled: boolean
  bank_transfer_instructions: string | null
  business_id: string
  contact_email: string | null
  contact_phone: string | null
  created_at: string
  delivery_enabled: boolean
  hero_banner_path: string | null
  hero_subtitle: string | null
  hero_title: string
  id: string
  pay_on_delivery_enabled: boolean
  pickup_address: string | null
  pickup_enabled: boolean
  primary_color: string
  published_at: string | null
  seo_description: string | null
  seo_title: string | null
  status: string
  storefront_copy: Json
  updated_at: string
}

type StorefrontDeliveryZoneRow = {
  business_id: string
  coverage_details: string | null
  created_at: string
  delivery_fee: number
  id: string
  is_active: boolean
  name: string
  position: number
  updated_at: string
}

type StorefrontProductRow = {
  business_id: string
  created_at: string
  is_featured: boolean
  is_visible: boolean
  position: number
  product_id: string
  updated_at: string
}

type StorefrontCheckoutRow = {
  business_id: string
  created_at: string
  id: string
  idempotency_key: string
  order_id: string
}

export type Database = {
  public: {
    Tables: {
      activity_logs: DomainTable<
        ActivityLogRow,
        "action" | "actor_name" | "business_id" | "entity_type",
        "id" | "created_at"
      >
      billing_invoices: DomainTable<
        BillingInvoiceRow,
        "amount_due" | "business_id" | "currency_code" | "invoice_number" | "issued_at" | "status",
        "id" | "created_at"
      >
      business_billing_profiles: DomainTable<
        BusinessBillingProfileRow,
        "business_id",
        "created_at" | "updated_at"
      >
      categories: DomainTable<
        CategoryRow,
        "business_id" | "created_by" | "name" | "slug"
      >
      business_members: {
        Row: {
          business_id: string
          created_at: string
          display_name: string
          email: string | null
          id: string
          invited_by: string | null
          joined_at: string
          phone: string | null
          role_id: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          business_id: string
          created_at?: string
          display_name: string
          email?: string | null
          id?: string
          invited_by?: string | null
          joined_at?: string
          phone?: string | null
          role_id: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          business_id?: string
          created_at?: string
          display_name?: string
          email?: string | null
          id?: string
          invited_by?: string | null
          joined_at?: string
          phone?: string | null
          role_id?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "business_members_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "business_members_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "business_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      businesses: {
        Row: {
          address: string | null
          category_code: string | null
          country_code: string | null
          currency_code: string
          created_at: string
          created_by: string
          date_format: string
          description: string | null
          email: string | null
          facebook_page: string | null
          id: string
          instagram_account: string | null
          locale: string
          logo_path: string | null
          name: string
          onboarding_completed_at: string | null
          opening_hours: Json
          phone: string | null
          slug: string
          time_format: string
          timezone: string
          updated_at: string
          website_url: string | null
          week_starts_on: number
          whatsapp_phone: string | null
        }
        Insert: {
          address?: string | null
          category_code?: string | null
          country_code?: string | null
          currency_code?: string
          created_at?: string
          created_by: string
          date_format?: string
          description?: string | null
          email?: string | null
          facebook_page?: string | null
          id?: string
          instagram_account?: string | null
          locale?: string
          logo_path?: string | null
          name: string
          onboarding_completed_at?: string | null
          opening_hours?: Json
          phone?: string | null
          slug: string
          time_format?: string
          timezone?: string
          updated_at?: string
          website_url?: string | null
          week_starts_on?: number
          whatsapp_phone?: string | null
        }
        Update: {
          address?: string | null
          category_code?: string | null
          country_code?: string | null
          currency_code?: string
          created_at?: string
          created_by?: string
          date_format?: string
          description?: string | null
          email?: string | null
          facebook_page?: string | null
          id?: string
          instagram_account?: string | null
          locale?: string
          logo_path?: string | null
          name?: string
          onboarding_completed_at?: string | null
          opening_hours?: Json
          phone?: string | null
          slug?: string
          time_format?: string
          timezone?: string
          updated_at?: string
          website_url?: string | null
          week_starts_on?: number
          whatsapp_phone?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "businesses_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: DomainTable<
        CustomerRow,
        "business_id" | "created_by" | "full_name"
      >
      expense_categories: DomainTable<
        ExpenseCategoryRow,
        "business_id" | "created_by" | "name"
      >
      expenses: DomainTable<
        ExpenseRow,
        | "amount"
        | "business_id"
        | "category_id"
        | "created_by"
        | "name"
        | "payment_method"
      >
      inventory_levels: DomainTable<
        InventoryLevelRow,
        "business_id" | "location_id" | "product_id"
      >
      inventory_locations: DomainTable<
        InventoryLocationRow,
        "business_id" | "code" | "created_by" | "name"
      >
      inventory_movements: DomainTable<
        InventoryMovementRow,
        | "business_id"
        | "created_by"
        | "location_id"
        | "movement_type"
        | "product_id"
        | "quantity_delta"
      >
      order_items: DomainTable<
        OrderItemRow,
        | "business_id"
        | "order_id"
        | "product_name"
        | "quantity"
        | "unit_price",
        "line_total"
      >
      order_status_history: DomainTable<
        OrderStatusHistoryRow,
        "business_id" | "changed_by" | "new_status" | "order_id"
      >
      orders: DomainTable<
        OrderRow,
        "business_id" | "created_by" | "order_number"
      >
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          full_name: string | null
          id: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      products: DomainTable<
        ProductRow,
        "business_id" | "created_by" | "name"
      >
      product_media: DomainTable<
        ProductMediaRow,
        | "business_id"
        | "created_by"
        | "file_name"
        | "file_size"
        | "media_kind"
        | "mime_type"
        | "product_id"
        | "storage_path"
      >
      product_variants: DomainTable<
        ProductVariantRow,
        | "business_id"
        | "created_by"
        | "name"
        | "product_id"
        | "selling_price"
      >
      permissions: {
        Row: {
          action: string
          code: string
          created_at: string
          description: string | null
          feature: string
          name: string
        }
        Insert: {
          action: string
          code: string
          created_at?: string
          description?: string | null
          feature: string
          name: string
        }
        Update: {
          action?: string
          code?: string
          created_at?: string
          description?: string | null
          feature?: string
          name?: string
        }
        Relationships: []
      }
      role_permissions: {
        Row: {
          created_at: string
          permission_code: string
          role_id: string
        }
        Insert: {
          created_at?: string
          permission_code: string
          role_id: string
        }
        Update: {
          created_at?: string
          permission_code?: string
          role_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "role_permissions_permission_code_fkey"
            columns: ["permission_code"]
            isOneToOne: false
            referencedRelation: "permissions"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "role_permissions_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
        ]
      }
      roles: {
        Row: {
          code: string
          created_at: string
          description: string | null
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          description?: string | null
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      sale_items: DomainTable<
        SaleItemRow,
        | "business_id"
        | "product_name"
        | "quantity"
        | "sale_id"
        | "unit_price",
        "line_total"
      >
      sales: DomainTable<
        SaleRow,
        "business_id" | "created_by" | "sale_number"
      >
      storefront_checkouts: DomainTable<
        StorefrontCheckoutRow,
        "business_id" | "idempotency_key" | "order_id",
        "id" | "created_at"
      >
      storefront_delivery_zones: DomainTable<
        StorefrontDeliveryZoneRow,
        "business_id" | "delivery_fee" | "name",
        "id" | "created_at"
      >
      storefront_products: DomainTable<
        StorefrontProductRow,
        "business_id" | "product_id"
      >
      storefronts: DomainTable<
        StorefrontRow,
        "business_id" | "hero_title",
        "id" | "created_at"
      >
      staff_invitations: {
        Row: {
          accepted_at: string | null
          accepted_by: string | null
          business_id: string
          created_at: string
          email: string
          expires_at: string
          full_name: string
          id: string
          invited_by: string
          last_sent_at: string
          phone: string | null
          requires_password: boolean
          revoked_at: string | null
          role_id: string
          status: string
          updated_at: string
        }
        Insert: {
          accepted_at?: string | null
          accepted_by?: string | null
          business_id: string
          created_at?: string
          email: string
          expires_at?: string
          full_name: string
          id?: string
          invited_by: string
          last_sent_at?: string
          phone?: string | null
          requires_password?: boolean
          revoked_at?: string | null
          role_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          accepted_at?: string | null
          accepted_by?: string | null
          business_id?: string
          created_at?: string
          email?: string
          expires_at?: string
          full_name?: string
          id?: string
          invited_by?: string
          last_sent_at?: string
          phone?: string | null
          requires_password?: boolean
          revoked_at?: string | null
          role_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_invitations_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_invitations_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: Record<never, never>
    Functions: {
      create_storefront_order: {
        Args: {
          checkout_buyer_email: string
          checkout_buyer_name: string
          checkout_buyer_phone: string
          checkout_delivery_address: string
          checkout_delivery_method: string
          checkout_delivery_zone_id: string | null
          checkout_idempotency_key: string
          checkout_items: Json
          checkout_notes: string
          checkout_payment_method: string
          store_slug: string
        }
        Returns: {
          bank_transfer_instructions: string | null
          currency_code: string
          order_id: string
          order_number: string
          payment_method: string
          total_amount: number
        }[]
      }
      get_public_storefront: {
        Args: { include_draft?: boolean; store_slug: string }
        Returns: {
          announcement: string | null
          bank_transfer_enabled: boolean
          bank_transfer_instructions: string | null
          business_id: string
          business_name: string
          business_slug: string
          contact_email: string | null
          contact_phone: string | null
          currency_code: string
          delivery_enabled: boolean
          delivery_zones: Json
          hero_banner_path: string | null
          hero_subtitle: string | null
          hero_title: string
          logo_path: string | null
          pay_on_delivery_enabled: boolean
          pickup_address: string | null
          pickup_enabled: boolean
          primary_color: string
          seo_description: string | null
          seo_title: string | null
          storefront_status: string
          storefront_copy: Json
        }[]
      }
      get_public_storefront_products: {
        Args: {
          include_draft?: boolean
          selected_product_id?: string
          store_slug: string
        }
        Returns: {
          available_stock: number | null
          category_id: string | null
          category_name: string | null
          description: string | null
          discount_price: number | null
          is_featured: boolean
          media: Json
          product_id: string
          product_name: string
          selling_price: number
          specifications: Json
          track_inventory: boolean
          variants: Json
        }[]
      }
      save_storefront: {
        Args: {
          featured_product_ids: string[]
          published_product_ids: string[]
          requested_status: string
          storefront_configuration: Json
          target_business_id: string
        }
        Returns: {
          published_product_count: number
          store_slug: string
          storefront_status: string
        }[]
      }
      save_storefront_with_copy: {
        Args: {
          featured_product_ids: string[]
          published_product_ids: string[]
          requested_status: string
          storefront_configuration: Json
          target_business_id: string
        }
        Returns: {
          published_product_count: number
          store_slug: string
          storefront_status: string
        }[]
      }
      search_business_activity: {
        Args: {
          result_limit?: number
          result_offset?: number
          search_query?: string
          selected_area?: string
          target_business_id: string
        }
        Returns: {
          action: string
          activity_id: string
          actor_name: string
          actor_user_id: string | null
          entity_id: string | null
          entity_name: string | null
          entity_type: string
          new_value: Json | null
          occurred_at: string
          previous_value: Json | null
          total_count: number
        }[]
      }
      accept_staff_invitation: {
        Args: {
          accepted_name: string
          accepted_phone: string | null
          target_invitation_id: string
        }
        Returns: {
          business_id: string
          business_name: string
          role_name: string
        }[]
      }
      create_staff_invitation: {
        Args: {
          invited_email: string
          invited_name: string
          invited_phone: string | null
          invited_role_code: string
          target_business_id: string
          target_invitation_id: string
        }
        Returns: {
          business_name: string
          expires_at: string
          invitation_id: string
          role_name: string
        }[]
      }
      get_my_business_permissions: {
        Args: { target_business_id: string }
        Returns: { permission_code: string }[]
      }
      get_my_staff_invitation: {
        Args: { target_invitation_id: string }
        Returns: {
          business_id: string
          business_name: string
          email: string
          expires_at: string
          full_name: string
          invitation_id: string
          permission_codes: string[]
          phone: string | null
          requires_password: boolean
          role_code: string
          role_name: string
          status: string
        }[]
      }
      get_staff_management: {
        Args: { target_business_id: string }
        Returns: {
          email: string | null
          expires_at: string | null
          full_name: string
          invited_at: string
          is_current_user: boolean
          joined_at: string | null
          phone: string | null
          record_id: string
          record_kind: string
          role_code: string
          role_name: string
          status: string
          user_id: string | null
        }[]
      }
      get_staff_role_options: {
        Args: { target_business_id: string }
        Returns: {
          permission_codes: string[]
          role_code: string
          role_description: string | null
          role_name: string
        }[]
      }
      has_business_permission: {
        Args: { requested_permission: string; target_business_id: string }
        Returns: boolean
      }
      prepare_staff_invitation_resend: {
        Args: { target_business_id: string; target_invitation_id: string }
        Returns: {
          business_name: string
          expires_at: string
          invitation_id: string
          invited_email: string
          invited_name: string
          invited_phone: string | null
          role_name: string
        }[]
      }
      revoke_staff_invitation: {
        Args: { target_business_id: string; target_invitation_id: string }
        Returns: boolean
      }
      update_business_staff_member: {
        Args: {
          requested_role_code: string
          requested_status: string
          target_business_id: string
          target_member_id: string
        }
        Returns: boolean
      }
      get_crm_customer_profile: {
        Args: { target_business_id: string; target_customer_id: string }
        Returns: {
          address: string | null
          average_order: number
          birthday: string | null
          created_at: string
          customer_id: string
          customer_segment: string
          customer_source: string
          customer_tags: string[]
          email: string | null
          full_name: string
          last_product_name: string | null
          last_purchase_at: string | null
          notes: string | null
          phone: string | null
          purchase_count: number
          total_spent: number
        }[]
      }
      get_customer_purchase_history: {
        Args: {
          result_limit?: number
          result_offset?: number
          target_business_id: string
          target_customer_id: string
        }
        Returns: {
          currency_code: string
          document_id: string
          document_kind: string
          document_number: string
          document_status: string
          first_product_name: string | null
          issued_at: string
          payment_status: string
          total_amount: number
          total_count: number
        }[]
      }
      get_customer_segment_metrics: {
        Args: { target_business_id: string }
        Returns: {
          customer_count: number
          customer_segment: string
          total_revenue: number
        }[]
      }
      save_crm_customer: {
        Args: {
          customer_profile: Json
          target_business_id: string
          target_customer_id: string | null
        }
        Returns: { customer_id: string; was_created: boolean }[]
      }
      search_crm_customers: {
        Args: {
          result_limit?: number
          result_offset?: number
          search_query?: string
          selected_segment?: string
          target_business_id: string
        }
        Returns: {
          average_order: number
          customer_id: string
          customer_segment: string
          customer_tags: string[]
          email: string | null
          full_name: string
          last_product_name: string | null
          last_purchase_at: string | null
          phone: string | null
          purchase_count: number
          total_count: number
          total_spent: number
        }[]
      }
      create_manual_order: {
        Args: {
          items: Json
          order_buyer_name: string | null
          order_buyer_phone: string | null
          order_discount_amount: number
          order_notes: string | null
          order_shipping_amount: number
          selected_customer_id: string | null
          target_business_id: string
        }
        Returns: {
          order_id: string
          order_number: string
          total_amount: number
        }[]
      }
      create_manual_order_with_delivery: {
        Args: {
          items: Json
          order_buyer_name: string | null
          order_buyer_phone: string | null
          order_delivery_address: string
          order_discount_amount: number
          order_notes: string | null
          order_shipping_amount: number
          selected_customer_id: string | null
          target_business_id: string
        }
        Returns: {
          order_id: string
          order_number: string
          total_amount: number
        }[]
      }
      complete_pos_sale: {
        Args: {
          items: Json
          sale_discount_amount: number
          selected_customer_id: string | null
          selected_payment_method: string
          target_business_id: string
        }
        Returns: {
          sale_id: string
          sale_number: string
          total_amount: number
        }[]
      }
      complete_pos_sale_with_buyer: {
        Args: {
          items: Json
          sale_discount_amount: number
          selected_customer_id: string | null
          selected_payment_method: string
          target_business_id: string
          transaction_buyer_name: string | null
          transaction_buyer_phone: string | null
        }
        Returns: {
          sale_id: string
          sale_number: string
          total_amount: number
        }[]
      }
      create_pos_invoice: {
        Args: {
          invoice_discount_amount: number
          items: Json
          selected_customer_id: string | null
          target_business_id: string
        }
        Returns: {
          invoice_id: string
          invoice_number: string
          total_amount: number
        }[]
      }
      create_pos_invoice_with_buyer: {
        Args: {
          invoice_discount_amount: number
          items: Json
          selected_customer_id: string | null
          target_business_id: string
          transaction_buyer_name: string | null
          transaction_buyer_phone: string | null
        }
        Returns: {
          invoice_id: string
          invoice_number: string
          total_amount: number
        }[]
      }
      create_pos_invoice_with_buyer_and_payment: {
        Args: {
          invoice_discount_amount: number
          items: Json
          selected_customer_id: string | null
          selected_payment_method: string
          target_business_id: string
          transaction_buyer_name: string | null
          transaction_buyer_phone: string | null
        }
        Returns: {
          invoice_id: string
          invoice_number: string
          total_amount: number
        }[]
      }
      get_dashboard_metrics: {
        Args: {
          range_end: string
          range_start: string
          target_business_id: string
        }
        Returns: {
          customers_count: number
          expenses_total: number
          low_stock_count: number
          orders_count: number
          out_of_stock_count: number
          pending_orders_count: number
          products_count: number
          profit_total: number
          sales_total: number
        }[]
      }
      get_expense_metrics: {
        Args: { target_business_id: string }
        Returns: {
          recorded_total: number
          this_month_total: number
          top_category_name: string | null
          total_count: number
        }[]
      }
      get_expense_staff_options: {
        Args: { target_business_id: string }
        Returns: {
          full_name: string
          role_code: string
          role_name: string
          staff_member_id: string
        }[]
      }
      get_inventory_metrics: {
        Args: {
          target_business_id: string
        }
        Returns: {
          inventory_value: number
          low_stock_count: number
          out_of_stock_count: number
          total_products: number
          total_units: number
        }[]
      }
      get_inventory_report_summary: {
        Args: {
          selected_category_id?: string
          target_business_id: string
        }
        Returns: {
          currency_code: string
          inventory_value: number
          low_stock_count: number
          out_of_stock_count: number
          total_products: number
          total_units: number
        }[]
      }
      get_order_metrics: {
        Args: {
          target_business_id: string
        }
        Returns: {
          completed_orders: number
          pending_orders: number
          processing_orders: number
          ready_orders: number
          total_orders: number
        }[]
      }
      get_profit_report_by_date: {
        Args: {
          range_end: string
          range_start: string
          target_business_id: string
        }
        Returns: {
          cogs: number
          currency_code: string
          expenses: number
          gross_profit: number
          net_profit: number
          report_date: string
          revenue: number
        }[]
      }
      get_profit_report_summary: {
        Args: {
          range_end: string
          range_start: string
          target_business_id: string
        }
        Returns: {
          cogs: number
          currency_code: string
          expenses: number
          gross_profit: number
          net_profit: number
          revenue: number
        }[]
      }
      get_report_filter_options: {
        Args: { target_business_id: string }
        Returns: {
          option_detail: string | null
          option_group: string
          option_id: string
          option_label: string
          option_order: number
        }[]
      }
      get_sales_report_summary: {
        Args: {
          range_end: string
          range_start: string
          selected_category_id?: string
          selected_payment_method?: string
          selected_product_id?: string
          selected_staff_id?: string
          target_business_id: string
        }
        Returns: {
          average_sale: number
          cogs: number
          currency_code: string
          gross_profit: number
          revenue: number
          transaction_count: number
          units_sold: number
        }[]
      }
      get_expense_report_by_category: {
        Args: {
          range_end: string
          range_start: string
          target_business_id: string
        }
        Returns: {
          category_id: string
          category_name: string
          currency_code: string
          expense_count: number
          percentage_of_total: number
          total_amount: number
        }[]
      }
      get_expense_report_by_date: {
        Args: {
          range_end: string
          range_start: string
          target_business_id: string
        }
        Returns: {
          currency_code: string
          expense_count: number
          expense_date: string
          total_amount: number
        }[]
      }
      get_sales_history: {
        Args: {
          result_limit?: number
          result_offset?: number
          target_business_id: string
        }
        Returns: {
          currency_code: string
          customer_name: string
          document_id: string
          document_kind: string
          document_number: string
          document_status: string
          issued_at: string
          payment_label: string
          total_amount: number
          total_count: number
        }[]
      }
      mark_pos_invoice_paid: {
        Args: {
          target_business_id: string
          target_invoice_id: string
        }
        Returns: {
          document_status: string
          invoice_id: string
          invoice_number: string
          payment_status: string
        }[]
      }
      mark_pos_invoice_paid_with_method: {
        Args: {
          selected_payment_method: string
          target_business_id: string
          target_invoice_id: string
        }
        Returns: {
          document_status: string
          invoice_id: string
          invoice_number: string
          payment_method: string
          payment_status: string
        }[]
      }
      record_inventory_operation: {
        Args: {
          operation_note?: string | null
          operation_type: string
          quantity_value: number
          target_business_id: string
          target_product_id: string
          target_variant_id: string | null
        }
        Returns: {
          current_stock: number
          movement_id: string
          movement_type: string
          product_id: string
          product_name: string
          quantity_delta: number
        }[]
      }
      record_business_expense: {
        Args: {
          attachment_file_name: string | null
          attachment_file_size: number | null
          attachment_mime_type: string | null
          attachment_storage_path: string | null
          expense_amount: number
          expense_category_id: string
          expense_date: string
          expense_description: string | null
          expense_name: string
          expense_payment_method: string
          expense_staff_member_id: string | null
          target_business_id: string
          target_expense_id: string | null
        }
        Returns: {
          expense_id: string
          was_created: boolean
        }[]
      }
      search_inventory_movements: {
        Args: {
          result_limit?: number
          result_offset?: number
          search_query?: string
          selected_movement_type?: string
          target_business_id: string
        }
        Returns: {
          created_by_name: string
          location_name: string
          movement_id: string
          movement_type: string
          note: string | null
          occurred_at: string
          product_id: string
          product_name: string
          product_sku: string | null
          quantity_delta: number
          total_count: number
          unit_cost: number | null
          variant_name: string | null
        }[]
      }
      search_inventory_movement_report: {
        Args: {
          range_end: string
          range_start: string
          result_limit?: number
          result_offset?: number
          selected_category_id?: string
          selected_movement_type?: string
          selected_product_id?: string
          target_business_id: string
        }
        Returns: {
          category_id: string | null
          category_name: string | null
          currency_code: string
          location_name: string
          movement_date: string
          movement_id: string
          movement_type: string
          movement_value: number
          note: string | null
          occurred_at: string
          product_id: string
          product_name: string
          product_sku: string | null
          quantity_delta: number
          staff_name: string
          total_count: number
          unit_cost: number
          variant_name: string | null
        }[]
      }
      search_inventory_products: {
        Args: {
          result_limit?: number
          result_offset?: number
          search_query?: string
          selected_stock_status?: string
          target_business_id: string
        }
        Returns: {
          category_name: string | null
          cost_price: number
          inventory_value: number
          low_stock_threshold: number
          primary_media_path: string | null
          product_id: string
          product_name: string
          product_sku: string | null
          product_status: string
          stock_quantity: number
          total_count: number
          tracks_inventory: boolean
          variants: Json
        }[]
      }
      search_inventory_stock_report: {
        Args: {
          result_limit?: number
          result_offset?: number
          selected_category_id?: string
          target_business_id: string
        }
        Returns: {
          category_id: string | null
          category_name: string | null
          currency_code: string
          product_id: string
          product_name: string
          product_sku: string | null
          reorder_level: number
          stock_quantity: number
          stock_status: string
          stock_value: number
          total_count: number
          tracks_inventory: boolean
          unit_cost: number
        }[]
      }
      search_sales_report: {
        Args: {
          range_end: string
          range_start: string
          result_limit?: number
          result_offset?: number
          selected_category_id?: string
          selected_payment_method?: string
          selected_product_id?: string
          selected_staff_id?: string
          target_business_id: string
        }
        Returns: {
          category_id: string | null
          category_name: string | null
          cogs: number
          currency_code: string
          customer_name: string
          discount_amount: number
          gross_profit: number
          payment_method: string
          product_id: string | null
          product_name: string
          quantity: number
          revenue: number
          sale_date: string
          sale_id: string
          sale_item_id: string
          sale_number: string
          staff_id: string
          staff_name: string
          total_count: number
          unit_price: number
          variant_name: string | null
        }[]
      }
      search_sales_history: {
        Args: {
          result_limit?: number
          result_offset?: number
          search_query?: string
          target_business_id: string
        }
        Returns: {
          currency_code: string
          customer_name: string
          document_id: string
          document_kind: string
          document_number: string
          document_status: string
          issued_at: string
          payment_label: string
          total_amount: number
          total_count: number
        }[]
      }
      search_business_orders: {
        Args: {
          result_limit?: number
          result_offset?: number
          search_query?: string
          selected_channel?: string
          selected_status?: string
          target_business_id: string
        }
        Returns: {
          buyer_name: string
          buyer_phone: string | null
          currency_code: string
          item_count: number
          order_channel: string
          order_id: string
          order_number: string
          order_status: string
          payment_status: string
          placed_at: string
          total_amount: number
          total_count: number
        }[]
      }
      search_business_expenses: {
        Args: {
          result_limit?: number
          result_offset?: number
          search_query?: string
          selected_category_id?: string
          selected_payment_method?: string
          target_business_id: string
        }
        Returns: {
          amount: number
          attachment_file_name: string | null
          attachment_file_size: number | null
          attachment_mime_type: string | null
          attachment_storage_path: string | null
          category_id: string
          category_name: string
          created_at: string
          currency_code: string
          description: string | null
          expense_date: string
          expense_id: string
          expense_name: string
          payment_method: string
          staff_member_id: string | null
          staff_member_name: string | null
          status: string
          total_count: number
        }[]
      }
      save_catalogue_product: {
        Args: {
          catalogue_product: Json
          target_business_id: string
          target_product_id: string | null
        }
        Returns: {
          product_id: string
          was_created: boolean
        }[]
      }
      reorder_catalogue_categories: {
        Args: {
          ordered_category_ids: string[]
          target_business_id: string
        }
        Returns: number
      }
      reorder_product_media: {
        Args: {
          ordered_media_ids: string[]
          target_business_id: string
          target_product_id: string
        }
        Returns: number
      }
      search_catalogue_products: {
        Args: {
          result_limit?: number
          result_offset?: number
          search_query?: string
          selected_category_id?: string
          selected_status?: string
          target_business_id: string
        }
        Returns: {
          category_id: string | null
          category_name: string | null
          discount_price: number | null
          low_stock_threshold: number
          primary_media_path: string | null
          product_id: string
          product_name: string
          product_sku: string | null
          product_status: string
          selling_price: number
          stock_quantity: number
          total_count: number
          tracks_inventory: boolean
          variant_count: number
        }[]
      }
      set_primary_product_media: {
        Args: {
          target_business_id: string
          target_media_id: string
          target_product_id: string
        }
        Returns: string
      }
      update_order_status: {
        Args: {
          requested_status: string
          status_note?: string | null
          target_business_id: string
          target_order_id: string
        }
        Returns: {
          current_status: string
          order_id: string
          order_number: string
          previous_status: string
        }[]
      }
      get_dashboard_recent_transactions: {
        Args: {
          range_end: string
          range_start: string
          result_limit?: number
          target_business_id: string
        }
        Returns: {
          channel: string
          customer_name: string
          sale_id: string
          sale_number: string
          sold_at: string
          status: string
          total_amount: number
        }[]
      }
      get_dashboard_sales_overview: {
        Args: {
          range_end: string
          range_start: string
          target_business_id: string
        }
        Returns: {
          period_date: string
          sales_total: number
          transaction_count: number
        }[]
      }
      get_dashboard_top_products: {
        Args: {
          range_end: string
          range_start: string
          result_limit?: number
          target_business_id: string
        }
        Returns: {
          category_name: string | null
          product_id: string
          product_name: string
          revenue: number
          units_sold: number
        }[]
      }
      is_business_creator: {
        Args: { target_business_id: string }
        Returns: boolean
      }
      is_business_member: {
        Args: { target_business_id: string }
        Returns: boolean
      }
      update_billing_contact: {
        Args: {
          target_billing_email: string
          target_business_id: string
        }
        Returns: undefined
      }
    }
    Enums: Record<never, never>
    CompositeTypes: Record<never, never>
  }
}

export type Tables<
  TableName extends keyof Database["public"]["Tables"],
> = Database["public"]["Tables"][TableName]["Row"]

export type TablesInsert<
  TableName extends keyof Database["public"]["Tables"],
> = Database["public"]["Tables"][TableName]["Insert"]

export type TablesUpdate<
  TableName extends keyof Database["public"]["Tables"],
> = Database["public"]["Tables"][TableName]["Update"]
