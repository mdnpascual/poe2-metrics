import { useLayoutEffect, useRef, useState } from "react";

type Row = { name: string; count: number; percentage: number };

type Props = {
	data: Row[];
	onSelect: (name: string) => void;
};

const DURATION_MS = 400;
const AXIS_TICKS = [0, 25, 50, 75, 100];

function prefersReducedMotion(): boolean {
	return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function AnimatedBarList({ data, onSelect }: Props) {
	const containerRef = useRef<HTMLDivElement>(null);
	const rowRefs = useRef(new Map<string, HTMLDivElement>());
	const prevTops = useRef(new Map<string, number>());
	const mounted = useRef(false);
	const reduceMotion = prefersReducedMotion();
	const [hover, setHover] = useState<{
		row: Row;
		x: number;
		y: number;
	} | null>(null);

	// FLIP: offsetTop is layout-based, so in-flight transforms don't skew it
	useLayoutEffect(() => {
		const container = containerRef.current;
		if (!container) return;
		const animate = mounted.current && !prefersReducedMotion();
		const moved: HTMLDivElement[] = [];
		const added: HTMLDivElement[] = [];
		const nextTops = new Map<string, number>();

		for (const [name, el] of rowRefs.current) {
			const newTop = el.offsetTop;
			nextTops.set(name, newTop);
			if (!animate) continue;
			const prev = prevTops.current.get(name);
			if (prev === undefined) {
				el.style.transition = "none";
				el.style.opacity = "0";
				added.push(el);
			} else if (prev !== newTop) {
				el.style.transition = "none";
				el.style.transform = `translateY(${prev - newTop}px)`;
				moved.push(el);
			}
		}
		prevTops.current = nextTops;
		mounted.current = true;

		if (!moved.length && !added.length) return;
		void container.offsetHeight;
		const frame = requestAnimationFrame(() => {
			for (const el of moved) {
				el.style.transition = `transform ${DURATION_MS}ms ease-out`;
				el.style.transform = "";
			}
			for (const el of added) {
				el.style.transition = `opacity ${DURATION_MS}ms ease-out`;
				el.style.opacity = "";
			}
		});
		return () => cancelAnimationFrame(frame);
	}, [data]);

	return (
		<div>
			<div ref={containerRef} className="relative">
				{data.map((row) => (
					<div
						key={row.name}
						ref={(el) => {
							if (el) rowRefs.current.set(row.name, el);
							else rowRefs.current.delete(row.name);
						}}
						className="relative flex h-10 items-center cursor-pointer hover:bg-gray-800/50"
						onClick={() => {
							setHover(null);
							onSelect(row.name);
						}}
						onMouseMove={(e) =>
							setHover({ row, x: e.clientX, y: e.clientY })
						}
						onMouseLeave={() => setHover(null)}
					>
						<div
							className="w-[400px] shrink-0 line-clamp-2 pr-3 text-right text-[12px] leading-[14px] text-[#e5e7eb]"
							title={row.name}
						>
							{row.name}
						</div>
						<div className="relative mr-5 flex h-full flex-1 items-center border-l border-[#e5e7eb]">
							<span className="absolute -left-[6px] top-1/2 h-px w-[5px] bg-[#e5e7eb]" />
							<div
								className="h-8 bg-[#6366f1]"
								style={{
									width: `${row.percentage}%`,
									transition: reduceMotion
										? "none"
										: `width ${DURATION_MS}ms ease-out`,
								}}
							/>
						</div>
					</div>
				))}
			</div>
			{hover && (
				<div
					className="pointer-events-none fixed z-10 whitespace-nowrap border px-2 py-1 text-sm"
					style={{
						left: hover.x + 12,
						top: hover.y + 12,
						background: "#1f2937",
						borderColor: "#374151",
						color: "#e5e7eb",
					}}
				>
					{hover.row.count} items ({hover.row.percentage}%)
				</div>
			)}
			<div className="flex text-[13px] text-[#e5e7eb]">
				<div className="w-[400px] shrink-0" />
				<div className="mr-5 flex flex-1 justify-between">
					{AXIS_TICKS.map((t) => (
						<span key={t}>{t}%</span>
					))}
				</div>
			</div>
		</div>
	);
}
