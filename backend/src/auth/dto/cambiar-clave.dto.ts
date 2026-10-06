import { IsNotEmpty, IsString, Length, MaxLength } from 'class-validator';

export class CambiarClaveDto {
  @IsString()
  @IsNotEmpty({ message: 'Debe ingresar su usuario' })
  @MaxLength(30)
  usuario: string;

  @IsString()
  @IsNotEmpty({ message: 'Debe ingresar su clave actual' })
  @MaxLength(30)
  claveActual: string;

  @IsString()
  @Length(8, 30, { message: 'La nueva clave debe tener entre 8 y 30 caracteres' })
  claveNueva: string;
}
