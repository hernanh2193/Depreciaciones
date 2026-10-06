import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class LoginDto {
  @IsString()
  @IsNotEmpty({ message: 'Debe ingresar su usuario' })
  @MaxLength(30)
  usuario: string;

  @IsString()
  @IsNotEmpty({ message: 'Debe ingresar su clave' })
  @MaxLength(30)
  clave: string;
}
