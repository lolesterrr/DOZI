import {
  Group,
  Image,
  Oval,
  Path,
  Rect,
  Text,
  type SkFont,
  type SkImage,
} from '@shopify/react-native-skia';

import { annotationColours } from '@/theme/tokens';

import {
  arrowPaths,
  freehandPath,
  rectBetween,
  strokeWidthFor,
  textOrigin,
  textSizeFor,
  type Shape,
  type Size,
} from '../logic';

export type AnnotationSceneProps = {
  /** The base image, drawn at its own pixel size at (0, 0). */
  image: SkImage;
  size: Size;
  shapes: readonly Shape[];
  /** The font for text labels, already at `textSizeFor(size)`. */
  font: SkFont | null;
};

/**
 * The image with its drawing on top, in image pixels. The same tree is drawn on screen (scaled
 * to fit) and off screen to make the saved JPEG, so what the student sees is what is saved.
 */
export function AnnotationScene({ image, size, shapes, font }: AnnotationSceneProps) {
  const strokeWidth = strokeWidthFor(size);
  return (
    <Group>
      <Image image={image} x={0} y={0} width={size.width} height={size.height} fit="fill" />
      {shapes.map((shape, index) => (
        <ShapeView key={index} shape={shape} size={size} strokeWidth={strokeWidth} font={font} />
      ))}
    </Group>
  );
}

function ShapeView({
  shape,
  size,
  strokeWidth,
  font,
}: {
  shape: Shape;
  size: Size;
  strokeWidth: number;
  font: SkFont | null;
}) {
  const { pen, halo } = annotationColours[shape.colour];
  const stroke = {
    color: pen,
    style: 'stroke' as const,
    strokeWidth,
    strokeCap: 'round' as const,
    strokeJoin: 'round' as const,
  };
  switch (shape.kind) {
    case 'arrow': {
      const { shaft, head } = arrowPaths(shape.from, shape.to, strokeWidth);
      return (
        <Group>
          <Path path={shaft} {...stroke} />
          <Path path={head} color={pen} style="fill" />
          <Path path={head} {...stroke} strokeWidth={strokeWidth / 2} />
        </Group>
      );
    }
    case 'box':
      return <Rect rect={rectBetween(shape.from, shape.to)} {...stroke} />;
    case 'circle':
      return <Oval rect={rectBetween(shape.from, shape.to)} {...stroke} />;
    case 'freehand':
      return <Path path={freehandPath(shape.points)} {...stroke} />;
    case 'text': {
      if (!font) return null;
      const textSize = textSizeFor(size);
      const origin = textOrigin(shape.at, font.getTextWidth(shape.text), textSize, size);
      return (
        <Group>
          {/* A thick outline in a contrasting colour keeps the label readable on any photo. */}
          <Text
            x={origin.x}
            y={origin.y}
            text={shape.text}
            font={font}
            color={halo}
            style="stroke"
            strokeWidth={Math.max(3, textSize * 0.16)}
            strokeJoin="round"
          />
          <Text x={origin.x} y={origin.y} text={shape.text} font={font} color={pen} />
        </Group>
      );
    }
  }
}
