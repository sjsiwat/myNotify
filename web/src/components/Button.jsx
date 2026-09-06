const SIZE = {
  md: 'px-[18px] py-[9px] text-[13px]',
  sm: 'px-[13px] py-[6px] text-[12.5px]',
}

const FLAT_FACE = {
  ghost: 'bg-surface text-ink hover:bg-surface-2',
  danger: 'bg-surface text-[#c22e00] hover:bg-accent-soft',
}

/**
 * ปุ่มหลักของทั้งแอป
 * - variant="primary": กล่องดำลอยเหนือแผ่นสีซ้อนสองชั้น (อ้างอิงสไตล์ปุ่ม Signup ใน Figma ref)
 * - variant="ghost"/"danger": เงาดำทึบชั้นเดียวแบบเดิมของแอป กด-ยก ตามอินเทอร์แอกชันเดิม
 */
export default function Button({
  as: As = 'button', variant = 'primary', size = 'md', className = '', children, disabled, ...rest
}) {
  const base = `font-display font-bold uppercase tracking-[0.02em] whitespace-nowrap inline-flex items-center gap-1.5 no-underline border-2 border-line rounded-[10px] ${SIZE[size]}`
  const disabledCls = disabled ? 'pointer-events-none opacity-50' : ''

  if (variant === 'primary') {
    return (
      <As className={`btn-stack ${disabledCls} ${className}`} disabled={disabled} {...rest}>
        <span className="layer l1 bg-accent" aria-hidden="true" />
        <span className="layer l2 bg-blue-soft" aria-hidden="true" />
        <span className={`face bg-ink text-surface ${base}`}>{children}</span>
      </As>
    )
  }

  return (
    <As
      className={`${base} ${FLAT_FACE[variant]} shadow-[4px_4px_0_var(--color-line)] transition-[transform,box-shadow] duration-100 hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[5px_5px_0_var(--color-line)] active:translate-x-0.5 active:translate-y-0.5 active:shadow-[1px_1px_0_var(--color-line)] ${disabledCls} ${className}`}
      disabled={disabled}
      {...rest}
    >
      {children}
    </As>
  )
}
