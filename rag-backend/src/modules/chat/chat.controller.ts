import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  Param,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ChatService } from './chat.service';
import { CreateSessionDto } from './dto/create-session.dto';
import { SendMessageDto } from './dto/send-message.dto';

type AuthRequest = Request & { user: { id: string; email: string } };

@ApiTags('Chat')
@ApiBearerAuth()
@Controller('chat')
@UseGuards(JwtAuthGuard)
export class ChatController {
  constructor(private chatService: ChatService) {}

  @Post('sessions')
  createSession(@Body() dto: CreateSessionDto, @Req() req: AuthRequest) {
    return this.chatService.createSession(req.user.id, dto.title);
  }

  @Get('sessions')
  listSessions(@Req() req: AuthRequest) {
    return this.chatService.listSessions(req.user.id);
  }

  @Get('sessions/:id')
  getSession(@Param('id') id: string, @Req() req: AuthRequest) {
    return this.chatService.getSession(id, req.user.id);
  }

  @Delete('sessions/:id')
  deleteSession(@Param('id') id: string, @Req() req: AuthRequest) {
    return this.chatService.deleteSession(id, req.user.id);
  }

  @Post('sessions/:id/messages')
  @Throttle({ default: { ttl: 60_000, limit: 30 } })
  @ApiOperation({ summary: 'Send a message and receive a streamed RAG answer' })
  async sendMessage(
    @Param('id') id: string,
    @Body() dto: SendMessageDto,
    @Req() req: AuthRequest,
    @Res() res: Response,
  ) {
    await this.chatService.sendMessage(id, req.user.id, dto.question, res);
  }
}
