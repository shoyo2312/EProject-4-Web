import Link from "next/link";

/**
 * 404 — rebuilt to the proportions of the live `tiktok.com/404` page
 * (measured at a 1920px viewport, 2026-09):
 *
 *   wrapper    padding 116px top / 130px bottom, pastel wash bg (cover, centred)
 *   digits     font-size 300px, line-height 244px, weight 500, colour #161823
 *   smiley     244 × 244, sits inline between the two 4s
 *   sub-text   18px / weight 400 / #161823 @ 50%, margin-top 24px
 *   heading    24px / weight 700 / #161823,        margin-top 40px
 *   button     360 × 48, radius 4, bg #fe2c55, 18px white, margin-top 16px
 *
 * The live page is fixed-size (it does not scale with the viewport); the digit
 * size is clamped here only so it cannot overflow a phone.
 */
export default function NotFound() {
  return (
    // Fixed overlay (z above the shell's fixed sidebar at z-99) so the 404
    // covers the browsing chrome — the live tiktok.com/404 has no app sidebar.
    <section
      className="fixed inset-0 z-[100] flex flex-col items-center overflow-auto bg-white bg-cover bg-center px-4 pb-[130px] pt-[116px] text-center text-[#161823]"
      style={{ backgroundImage: "url(/images/notfound/bg.png)" }}
    >
      <p
        className="flex items-center justify-center font-medium tracking-tighter"
        style={{ fontSize: "clamp(120px, 15.6vw, 300px)", lineHeight: "0.81" }}
      >
        <span>4</span>
        <img
          src="/images/notfound/smiley.png"
          alt=""
          width={244}
          height={244}
          className="mx-1 inline-block h-[0.81em] w-[0.81em] align-middle"
        />
        <span>4</span>
      </p>

      <p className="mt-6 text-[18px] font-normal leading-6 text-[#161823]/50">
        Couldn&apos;t find this page
      </p>

      <p className="mt-10 text-[24px] font-bold leading-[30px]">
        Check out more trending videos on TikTok
      </p>

      <Link
        href="/"
        className="mt-4 inline-flex h-12 w-[360px] max-w-full items-center justify-center gap-2 rounded-[4px] bg-[#fe2c55] px-2 text-[18px] font-bold text-white transition-colors hover:bg-[#ea284e]"
      >
        <span className="text-[12px]">▶</span> Watch now
      </Link>
    </section>
  );
}
