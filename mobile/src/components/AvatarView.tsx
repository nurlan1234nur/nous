import { Image, Text, type ImageStyle, type StyleProp, type TextStyle } from 'react-native';
import { assetUrl } from '../lib/api';
import { isImageAvatar } from '../lib/format';

interface Props {
  avatar?: string | null;
  name?: string | null;
  size: number;
  textStyle?: StyleProp<TextStyle>;
  fallback?: string;
}

// Avatar-ын агуулга: зураг бол Image, үгүй бол emoji/эхний үсэг. Хүрээ (өнгө, border)-г эцэг View өгнө.
export function AvatarView({ avatar, name, size, textStyle, fallback = '?' }: Props) {
  if (isImageAvatar(avatar)) {
    const style: ImageStyle = { borderRadius: size / 2, height: size, width: size };
    return <Image accessibilityLabel={name ?? 'avatar'} source={{ uri: assetUrl(avatar as string) }} style={style} />;
  }
  return <Text style={textStyle}>{avatar || name?.slice(0, 1).toUpperCase() || fallback}</Text>;
}
